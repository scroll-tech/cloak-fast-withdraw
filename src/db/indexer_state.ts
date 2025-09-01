import db from './client';

export const TABLE_NAME = 'indexer_state';

export async function get(): Promise<number> {
  const row = await db(TABLE_NAME).select('last_processed_block').first();
  return row?.last_processed_block ?? 0;
}

export async function set(last_processed_block: number) {
  await db(TABLE_NAME)
    .insert({ id: true, last_processed_block })
    .onConflict('id')
    .merge({ last_processed_block, updated_at: db.fn.now() });
}
