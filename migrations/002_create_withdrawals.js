const TABLE_NAME = 'withdrawals';

exports.up = async function (knex) {
  await knex.schema.createTable(TABLE_NAME, t => {
    t.increments('id').primary();
    t.string('validium_tx_hash', 66).notNullable().unique(); // bytes32 with 0x prefix

    t.enu('status', ['PENDING', 'APPROVED', 'REJECTED'], {
      useNative: true,
      enumName: 'withdrawal_status',
    }).notNullable();

    t.text('reject_reason');
    t.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  const isPg = knex.client.config.client === 'pg';

  if (isPg) {
    await knex.schema.raw(`DROP TYPE IF EXISTS withdrawal_status`);
  }

  await knex.schema.dropTableIfExists(TABLE_NAME);
};
