import express, { Request, Response } from 'express';

import { config } from './config';
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

async function startServer() {
  const app = express();

  app.disable('x-powered-by');

  // Register health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  const server = app.listen(config.port);
  logger.info(`Server listening on port ${config.port}`);

  const close = (signal: string) => () => {
    logger.debug(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', close('SIGTERM'));
  process.on('SIGINT', close('SIGINT'));
}

async function main() {
  await runMigrations();
  await startServer();

  await Promise.all([
    indexTransactions(),
    processWithdrawals(),
    processMessages(),
    processTransactions(),
  ]);
}

main().catch((err) => {
  logger.error('Error occurred in main:', err);
  process.exit(1);
});
