import { ethers, ZeroAddress, ZeroHash } from 'ethers';

import { config } from '../config';
import { sleep } from '../utils';
import { abi } from '../abi';

import db from '../db/client';
import * as messages from '../db/messages';
import * as transactions from '../db/transactions';

import baseLogger from '../logger';
const logger = baseLogger.child({ module: 'messages' });

const gasLimit = 200_000;

const hostProvider = new ethers.JsonRpcProvider(config.endpoints.host);
const wallet = new ethers.Wallet(config.signers.host, hostProvider);

const contract = new ethers.Contract(config.contracts.hostFastWithdrawVault, abi, wallet);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeRevertReason(error: any): string {
  try {
    // some providers put the data in error.data or error.body
    const data = error.error?.data || error.data;
    if (data) {
      // If it's a string starting with 0x
      const reason = ethers.AbiCoder.defaultAbiCoder().decode(
        ['string'],
        '0x' + data.substring(10), // strip the "0x08c379a0" selector
      )[0];
      return reason;
    }
  } catch {
    // fallback
  }

  // fallback to generic message
  return error.reason || error.message || String(error);
}

async function insertTx(tx: transactions.Transaction) {
  await db.transaction(async (dbTx) => {
    await dbTx(transactions.TABLE_NAME).insert(tx);

    const count = await dbTx(messages.TABLE_NAME)
      .where({ message_hash: tx.message_hash })
      .update({ status: 'INITIATED', updated_at: db.fn.now() });

    if (count !== 1) {
      // In case of concurrent modification, revert transaction.
      throw `Concurrent modification for message ${tx.message_hash}`;
    }
  });
}

export async function processMessage(
  m: messages.Message,
  persistTransaction: (tx: transactions.Transaction) => void,
) {
  logger.info(`Processing message: ${m.message_hash}`);

  const txParams = [
    m.host_token,
    m.to,
    String(m.amount),
    m.message_hash,
    m.permit,
    {
      from: wallet.address,
      gasLimit,
      // TODO: implement proper nonce management
      nonce: await hostProvider.getTransactionCount(wallet.address),
    },
  ];

  // First, try simulating the transaction
  try {
    await contract.claimFastWithdraw.staticCallResult(...txParams);
  } catch (err: unknown) {
    logger.warn(`Transaction simulation failed for message: ${m.message_hash}`);

    // @ts-ignore
    if (err.code !== 'CALL_EXCEPTION') {
      // @ts-ignore
      logger.error(`Unknown error: ${err.code}`);
      return;
    }

    const reason = decodeRevertReason(err);

    // Transaction failure: mark message as failed.
    if (reason === 'ErrorWithdrawAlreadyProcessed()') {
      logger.warn(`Message already processed`);

      // Insert a sentinel transaction and mark it as failed
      return await persistTransaction({
        hash: ZeroHash,
        message_hash: m.message_hash,
        sender: ZeroAddress,
        nonce: '0',
        status: 'FAILED',
        failure_reason: reason,
      } as transactions.Transaction);
    }

    // Operator errors: leave message as pending.
    else if (reason === 'ERC20: burn amount exceeds balance') {
      // execution reverted: ERC20: burn amount exceeds balance
      logger.error(`Error: ${reason}, please ensure the vault is funded`);
      return;
    } else if (reason.startsWith('AccessControl')) {
      // execution reverted: AccessControl: account 0xb51049260a95a06e8b10f3793cbb8c61b25a2ec4 is missing role 0xac4f1890dc96c9a02330d1fa696648a38f3b282d2449c2d8e6f10507488c84c8
      logger.error(`Error: ${reason}, please ensure the correct signer is configured`);
      return;
    } else {
      logger.error(`Revert reason: ${decodeRevertReason(err)}`);
      return;
    }
  }

  // Prepare tx and write to db before broadcasting,
  // to ensure that we have a record of the transaction.
  const txRequest = await contract.claimFastWithdraw.populateTransaction(...txParams);
  const tx = await wallet.populateTransaction(txRequest); // add chain id, etc.
  const signedTx = await wallet.signTransaction(tx); // sign into raw tx
  const txHash = ethers.keccak256(signedTx); // compute hash

  logger.debug(`Transaction prepared: from=${tx.from}, nonce=${tx.nonce}, hash=${txHash}`);

  await persistTransaction({
    hash: txHash,
    message_hash: m.message_hash,
    sender: tx.from,
    nonce: String(tx.nonce),
    status: 'PENDING',
  } as transactions.Transaction);

  // Broadcast to network, will check status later
  await hostProvider.broadcastTransaction(signedTx);
}

export async function processMessages() {
  logger.info('Background worker started: processMessages');

  // Fetch up to batchSize pending entries in one iteration.
  const batchSize: number = 10;

  // Time to wait idle between consecutive runs of this job,
  // if there are no pending items.
  const sleepMs: number = 1000;

  while (true) {
    const pending = await messages.pending(batchSize);

    for (const w of pending) {
      try {
        await processMessage(w, insertTx);
      } catch (err) {
        logger.error(`Unexpected error while processing message: ${err}`);
      }
    }

    if (pending.length >= batchSize) {
      continue;
    }

    await sleep(sleepMs);
  }
}
