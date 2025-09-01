const TABLE_NAME = 'indexer_state';

exports.up = async function (knex) {
  await knex.schema.createTable(TABLE_NAME, t => {
    t.boolean("id").primary().defaultTo(true);
    t.bigInteger("last_processed_block").notNullable();
    t.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists(TABLE_NAME);
};
