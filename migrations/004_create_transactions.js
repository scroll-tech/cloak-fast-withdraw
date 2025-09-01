const TABLE_NAME = 'transactions';

exports.up = async function (knex) {
  await knex.schema.createTable(TABLE_NAME, t => {
    t.increments('id').primary();
    t.string('hash', 66).notNullable(); // bytes32 with 0x prefix

    t.string('message_hash', 66).notNullable(); // bytes32 with 0x prefix
    t.string('sender', 42).notNullable();       // address with 0x prefix
    t.bigInteger('nonce').notNullable();        // uint256

    t.enu('status', ['PENDING', 'SUCCESSFUL', 'FAILED'], {
      useNative: true,
      enumName: 'transaction_status',
    }).notNullable();

    t.text('failure_reason');
    t.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  const isPg = knex.client.config.client === 'pg';

  if (isPg) {
    await knex.schema.raw(`DROP TYPE IF EXISTS transaction_status`);
  } else {
  }

  await knex.schema.dropTableIfExists(TABLE_NAME);
};
