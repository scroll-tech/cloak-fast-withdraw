const TABLE_NAME = 'messages';

exports.up = async function (knex) {
  await knex.schema.createTable(TABLE_NAME, t => {
    t.increments('id').primary();
    t.string('validium_tx_hash', 66).notNullable(); // bytes32 with 0x prefix

    t.string('host_token', 42).notNullable();     // address with 0x prefix
    t.string('validium_token', 42).notNullable(); // address with 0x prefix
    t.string('from', 42).notNullable();      // address with 0x prefix
    t.string('to', 42).notNullable();        // address with 0x prefix
    t.bigInteger('amount').notNullable();         // uint256
    t.string('message_hash', 66).notNullable();   // bytes32 with 0x prefix
    t.string('permit').notNullable();             // bytes with 0x prefix

    t.enu('status', ['PENDING', 'INITIATED'], {
      useNative: true,
      enumName: 'message_status',
    }).notNullable();

    t.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  const isPg = knex.client.config.client === 'pg';

  if (isPg) {
    await knex.schema.raw(`DROP TYPE IF EXISTS message_status`);
  }

  await knex.schema.dropTableIfExists(TABLE_NAME);
};
