import db from './client';

export const TABLE_NAME = 'transactions';

export type TransactionStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface Transaction {
  id: number;
  hash: string;
  message_hash: string;
  sender: string;
  nonce: string;
  status: TransactionStatus;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export async function all(): Promise<Transaction[]> {
  return db<Transaction>(TABLE_NAME).select('*');
}

export async function pending(limit: number): Promise<Transaction[]> {
  return db<Transaction>(TABLE_NAME)
    .select('*')
    .where({ status: 'PENDING' })
    .orderByRaw('random()')
    .limit(limit);
}
