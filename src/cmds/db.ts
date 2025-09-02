import db from '../db/client';
import * as withdrawals from '../db/withdrawals';
import * as messages from '../db/messages';
import * as transactions from '../db/transactions';

import { Command } from 'commander';

function grey(s: string): string {
  return `\x1b[1m\x1b[90m${s}\x1b[0m`;
}

function red(s: string): string {
  return `\x1b[1m\x1b[31m${s}\x1b[0m`;
}

function green(s: string): string {
  return `\x1b[1m\x1b[32m${s}\x1b[0m`;
}

function status(
  s: withdrawals.WithdrawalStatus | messages.MessageStatus | transactions.TransactionStatus,
): string {
  switch (s) {
    case 'PENDING':
      return grey(s);
    case 'REJECTED':
      return red(s);
    case 'FAILED':
      return red(s);
    case 'APPROVED':
      return green(s);
    case 'INITIATED':
      return green(s);
    case 'SUCCESSFUL':
      return green(s);
    default:
      return s;
  }
}

async function show(w: withdrawals.Withdrawal) {
  const reject_reason = w.reject_reason ?? '';
  console.log(grey('[withdraw]'), w.validium_tx_hash, status(w.status), red(reject_reason));

  const ms = await db<messages.Message>(messages.TABLE_NAME)
    .select('*')
    .where({ validium_tx_hash: w.validium_tx_hash })
    .orderBy('id', 'asc');

  for (const m of ms) {
    const message_hash = m.message_hash;
    console.log(grey('  [message]'), message_hash, status(m.status));

    const txs = await db<transactions.Transaction>(transactions.TABLE_NAME)
      .select('*')
      .where({ message_hash })
      .orderBy('id', 'asc');

    for (const t of txs) {
      const failure_reason = t.failure_reason ?? '';
      console.log(grey('    [transaction]'), t.hash, status(t.status), red(failure_reason));
    }
  }
}

async function showVerbose(w: withdrawals.Withdrawal) {
  console.log('\nwithdrawal', w);

  const ms = await db<messages.Message>(messages.TABLE_NAME)
    .select('*')
    .where({ validium_tx_hash: w.validium_tx_hash })
    .orderBy('id', 'asc');

  for (const m of ms) {
    console.log('\nmessage', m);
  }

  for (const m of ms) {
    const txs = await db<transactions.Transaction>(transactions.TABLE_NAME)
      .select('*')
      .where({ message_hash: m.message_hash })
      .orderBy('id', 'asc');

    for (const t of txs) {
      console.log('\ntransaction', t);
    }
  }
}

async function inspect(validium_tx_hash: string, { verbose }: { verbose?: boolean }) {
  const withdrawal = await db<withdrawals.Withdrawal>(withdrawals.TABLE_NAME)
    .select('*')
    .where({ validium_tx_hash })
    .first();

  if (!withdrawal) {
    console.log('No withdrawal found');
    return;
  }

  await show(withdrawal);
  if (verbose) await showVerbose(withdrawal);

  process.exit(0);
}

const program = new Command();

program
  .command('inspect <validium_tx_hash>')
  .option('--verbose', 'enable verbose output')
  .action(inspect);

program.parse(process.argv);
