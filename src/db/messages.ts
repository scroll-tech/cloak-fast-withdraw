import db from './client';

export const TABLE_NAME = 'messages';

export type MessageStatus = 'PENDING' | 'INITIATED';

export interface Message {
  id: number;
  validium_tx_hash: string;
  host_token: string;
  validium_token: string;
  from: string;
  to: string;
  amount: string;
  message_hash: string;
  permit: string;
  status: MessageStatus;
  created_at: string;
  updated_at: string;
}

export async function get(message_hash: string): Promise<Message | undefined> {
  return db<Message>(TABLE_NAME).where({ message_hash }).first();
}

export async function all(): Promise<Message[]> {
  return db<Message>(TABLE_NAME).select('*');
}

export async function pending(limit: number): Promise<Message[]> {
  return db<Message>(TABLE_NAME)
    .select('*')
    .where({ status: 'PENDING' })
    .orderByRaw('random()')
    .limit(limit);
}
