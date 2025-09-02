import { ethers, isAddress, Log } from 'ethers';

import { config } from '../config';
import { eq, sleep } from '../utils';
import { abi } from '../abi';

import db from '../db/client';
import * as withdrawals from '../db/withdrawals';
import * as messages from '../db/messages';

import baseLogger from '../logger';
const logger = baseLogger.child({ module: 'withdrawals' });

const validiumProvider = new ethers.JsonRpcProvider(config.endpoints.validium);
const permitSigner = new ethers.Wallet(config.signers.permit);

const iface = new ethers.Interface(abi);

// Request contains information about a fast withdraw request submitted by a user.
export interface Request {
  // Permit-related fields
  l1Token: string;
  l2Token: string;
  to: string;
  amount: bigint;
  messageHash: string;

  // The actual signed permit
  permit: string | null;

  // The withdraw tx to address for further checks
  withdrawTo: string;

  from: string;
}

function parseMessages(logs: readonly Log[]): Request[] {
  // Collect withdraw-related events: ValidiumMessageQueue.AppendMessage and ValidiumERC20Gateway.WithdrawERC20.
  // Note: There might be multiple pairs of such events in a single transaction.
  const events = logs
    .filter(
      (l) =>
        eq(l.address, config.contracts.validiumMessageQueue) ||
        eq(l.address, config.contracts.validiumERC20Gateway),
    )
    .map((l) => iface.parseLog(l))
    .filter((e) => e !== null)
    .reduce((acc, e) => {
      acc[e.name] = acc[e.name] || [];
      acc[e.name].push(e.args);
      return acc;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as any);

  const requests = [];

  for (let ii = 0; ii < events['AppendMessage'].length; ii++) {
    const appendEvent = events['AppendMessage'][ii];
    const withdrawEvent = events['WithdrawERC20'][ii];

    const request = {
      l1Token: withdrawEvent.getValue('hostToken'),
      l2Token: withdrawEvent.getValue('validiumToken'),
      from: withdrawEvent.getValue('from'),
      to: withdrawEvent.getValue('payload'), // Recipient address is encoded in payload
      amount: withdrawEvent.getValue('amount'),
      messageHash: appendEvent.getValue('messageHash'),
      permit: null,
      withdrawTo: withdrawEvent.getValue('to'),
    };

    requests.push(request);
  }

  return requests;
}

function validateRequests(requests: Request[]): string | null {
  for (const request of requests) {
    // L3 withdraw requests should be sent to the L2 fast withdraw vault
    if (!eq(request.withdrawTo, config.contracts.hostFastWithdrawVault)) {
      return `Invalid withdraw to address: ${request.withdrawTo}`;
    }

    // The L2 recipient address should be encoded in the message payload
    if (!isAddress(request.to)) {
      return `Invalid request to address: ${request.to}`;
    }

    // Only allow whitelisted tokens.
    if (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(config.tokenWhitelist.host as Record<string, any>)[request.l1Token]?.allowed &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(config.tokenWhitelist.validium as Record<string, any>)[request.l2Token]?.allowed
    ) {
      return `Invalid token, host: ${request.l1Token}, validium: ${request.l2Token}`;
    }
    // TODO: limit
  }

  return null;
}

async function signPermits(requests: Request[]) {
  for (const request of requests) {
    const permit = await permitSigner.signTypedData(config.eip721.domain, config.eip721.types, {
      l1Token: request.l1Token,
      l2Token: request.l2Token,
      to: request.to,
      amount: request.amount,
      messageHash: request.messageHash,
    });
    request.permit = permit;
  }
}

async function reject(validium_tx_hash: string, reason: string) {
  logger.warn(`Rejecting withdrawal ${validium_tx_hash}: ${reason}`);
  return await withdrawals.reject(validium_tx_hash, reason);
}

async function processWithdrawal(w: withdrawals.Withdrawal) {
  logger.info(`Processing withdrawal: ${w.validium_tx_hash}`);

  const receipt = await validiumProvider.getTransactionReceipt(w.validium_tx_hash);
  if (receipt === null) {
    return await reject(w.validium_tx_hash, 'Transaction not found');
  }

  const requests = parseMessages(receipt.logs);
  if (requests.length === 0) {
    return await reject(w.validium_tx_hash, 'No valid requests found');
  }

  const error = validateRequests(requests);
  if (error) {
    return await reject(w.validium_tx_hash, error);
  }

  await signPermits(requests);
  logger.debug(`Withdraw request approved: ${w.validium_tx_hash}`);

  await db.transaction(async (trx) => {
    for (const request of requests) {
      await trx(messages.TABLE_NAME).insert({
        validium_tx_hash: w.validium_tx_hash,
        host_token: request.l1Token,
        validium_token: request.l2Token,
        from: request.from,
        to: request.to,
        amount: request.amount.toString(),
        message_hash: request.messageHash,
        permit: request.permit,
        status: 'PENDING',
      } as messages.Message);
    }

    const count = await trx(withdrawals.TABLE_NAME)
      .where({ status: 'PENDING' })
      .where({ validium_tx_hash: w.validium_tx_hash })
      .update({ status: 'APPROVED', updated_at: db.fn.now() });

    if (count !== 1) {
      // In case of concurrent modification, revert transaction.
      throw `Concurrent modification for withdraw ${w.validium_tx_hash}`;
    }
  });
}

export async function processWithdrawals() {
  logger.info('Background worker started: processWithdrawals');

  // Fetch up to batchSize pending entries in one iteration.
  const batchSize: number = 10;

  // Time to wait idle between consecutive runs of this job,
  // if there are no pending items.
  const sleepMs: number = 1000;

  while (true) {
    const pending = await withdrawals.pending(batchSize);

    for (const w of pending) {
      try {
        await processWithdrawal(w);
      } catch (err) {
        logger.error(`Unexpected error while processing withdrawal: ${err}`);
      }
    }

    if (pending.length >= batchSize) {
      continue;
    }

    await sleep(sleepMs);
  }
}
