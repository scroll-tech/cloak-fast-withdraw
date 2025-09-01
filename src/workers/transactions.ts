import { ethers } from 'ethers';

import { config } from '../config';
import { sleep } from '../utils';

import db from '../db/client';
import * as transactions from '../db/transactions';
import * as messages from '../db/messages';

import { processMessage } from './messages';

import baseLogger from '../logger';
const logger = baseLogger.child({ module: 'transactions' });

const hostProvider = new ethers.JsonRpcProvider(config.endpoints.host);

async function resendTx(tx: transactions.Transaction, failure_reason: string | null) {
  const message = await messages.get(tx.message_hash);
  if (!message) return; // TODO

  processMessage(message, async (newTx: transactions.Transaction) => {
    await db.transaction(async (dbTx) => {
      await dbTx(transactions.TABLE_NAME)
        .where({ hash: tx.hash })
        .update({ status: 'FAILED', failure_reason, updated_at: db.fn.now() });
      await dbTx(transactions.TABLE_NAME).insert(newTx);
    });
  });
}

async function processTransaction(tx: transactions.Transaction) {
  logger.info(`Processing transaction: ${tx.hash}`);

  const receipt = await hostProvider.getTransactionReceipt(tx.hash);

  // Transaction is successfully executed
  if (receipt !== null && receipt.status === 1) {
    logger.debug(`Transaction is confirmed: ${tx.hash}`);

    return await db(transactions.TABLE_NAME)
      .where({ hash: tx.hash })
      .update({ status: 'SUCCESSFUL', updated_at: db.fn.now() });
  }

  // Transaction is executed but failed (rare)
  if (receipt !== null && receipt.status === 0) {
    logger.warn(`Transaction failed: ${tx.hash}`);
    return; // TODO: extract failure reason
  }

  const pendingTx = await hostProvider.getTransaction(tx.hash);

  if (pendingTx !== null) {
    logger.warn(`Transaction is pending: ${tx.hash}`);
    return; // TODO: bump gas
  }

  // Neither receipt nor tx is found => tx was dropped or never sent.
  logger.warn(`Transaction was dropped: ${tx.hash}`);
  await resendTx(tx, 'Transaction dropped');
}

export async function processTransactions() {
  logger.info('Background worker started: processTransactions');

  // Fetch up to batchSize pending entries in one iteration.
  const batchSize: number = 10;

  // Time to wait idle between consecutive runs of this job,
  // if there are no pending items.
  const sleepMs: number = 1000;

  while (true) {
    const pending = await transactions.pending(batchSize);

    for (const tx of pending) {
      try {
        await processTransaction(tx);
      } catch (err) {
        logger.error(`Unexpected error while processing transaction: ${err}`);
      }
    }

    if (pending.length >= batchSize) {
      continue;
    }

    await sleep(sleepMs);
  }
}
