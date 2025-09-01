import db from './client';

export const TABLE_NAME = 'withdrawals';

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Withdrawal {
  id: number;
  validium_tx_hash: string;
  status: WithdrawalStatus;
  reject_reason?: string;
  created_at: string;
  updated_at: string;
}

export async function insert(validium_tx_hash: string) {
  await db(TABLE_NAME)
    .insert({ validium_tx_hash, status: 'PENDING' })
    .onConflict('validium_tx_hash')
    .ignore();
}

export async function reject(validium_tx_hash: string, reject_reason?: string) {
  await db(TABLE_NAME)
    .where({ validium_tx_hash })
    .update({
      status: 'REJECTED',
      reject_reason: reject_reason ?? null,
      updated_at: db.fn.now(),
    });
}

export async function all(): Promise<Withdrawal[]> {
  return db<Withdrawal>(TABLE_NAME).select('*');
}

export async function pending(limit: number): Promise<Withdrawal[]> {
  return db<Withdrawal>(TABLE_NAME)
    .select('*')
    .where({ status: 'PENDING' })
    .orderByRaw('random()')
    .limit(limit);
}
