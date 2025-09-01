import logger from './logger';
import db from './db/client';

import { processWithdrawals } from './workers/withdrawals';
import { processMessages } from './workers/messages';
import { processTransactions } from './workers/transactions';
import { indexTransactions } from './workers/indexer';

async function runMigrations() {
  logger.info('Running migrations...');
  const [batchNo, log] = await db.migrate.latest();
  logger.info(`Batch ${batchNo} run: ${log.length} migrations`);
}

async function main() {
  await runMigrations();

  await Promise.all([
    indexTransactions(),
    processWithdrawals(),
    processMessages(),
    processTransactions(),
  ]);
}

main().catch((err) => {
  logger.error('Error occurred in main:', err);
});
