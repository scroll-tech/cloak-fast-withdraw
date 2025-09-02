import { ethers, EventLog } from 'ethers';

import { config } from '../config';
import { eq, sleep } from '../utils';
import { abi } from '../abi';

import * as indexer_state from '../db/indexer_state';
import * as withdrawals from '../db/withdrawals';

import baseLogger from '../logger';
const logger = baseLogger.child({ module: 'indexer' });

const validiumProvider = new ethers.JsonRpcProvider(config.endpoints.validium);
const contract = new ethers.Contract(config.contracts.validiumERC20Gateway, abi, validiumProvider);

async function indexBlocks(fromBlock: number, toBlock: number) {
  logger.debug(`Indexing block range: ${fromBlock} - ${toBlock}`);
  let events = await contract.queryFilter('WithdrawERC20', [Number(fromBlock)], Number(toBlock));
  if (events.length > 0) logger.debug(`${events.length} events found`);

  for (const event of events ) {
    const hash = event.transactionHash;
    const withdrawTo = (event as EventLog).args.getValue('to');

    if (!eq(withdrawTo, config.contracts.hostFastWithdrawVault)) {
      logger.debug(`Skipping transaction ${hash} with non-matching withdrawTo: ${withdrawTo}`);
      continue;
    }

    // idempotent insert
    withdrawals.insert(hash);
  }
}

export async function indexTransactions() {
  logger.info('Background worker started: indexTransactions');

  // Time to wait idle between consecutive runs of this job,
  // if there are no pending items.
  const sleepMs = 1000;

  // Event block confirmations.
  const confirmations = 3;

  // Batch size for eth_getLogs queries.
  const batchSize = 1000;

  // Number of blocks after which to persist the indexer state.
  const persistBlockCount = 1000;

  // Resume from the last processed block
  let lastPersistedBlock = await indexer_state.get();
  let lastProcessedBlock = lastPersistedBlock;
  logger.debug(`Resuming from last processed block: ${lastProcessedBlock}`);

  while (true) {
    const latest = await validiumProvider.getBlockNumber();
    const target = Math.max(0, latest - confirmations);

    if (target <= lastProcessedBlock) {
      await sleep(sleepMs);
      continue;
    }

    const fromBlock = lastProcessedBlock + 1;
    const toBlock = Math.min(target, fromBlock + batchSize - 1);

    try {
      await indexBlocks(fromBlock, toBlock);
    } catch (err) {
      logger.error(`Unexpected error while indexing events: ${err}`);
      await sleep(sleepMs);
      continue;
    }

    lastProcessedBlock = toBlock;

    if (lastProcessedBlock - lastPersistedBlock >= persistBlockCount) {
      await indexer_state.set(lastProcessedBlock);
      lastPersistedBlock = lastProcessedBlock;
    }
  }
}
