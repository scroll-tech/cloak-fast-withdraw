import knex, { Knex } from 'knex';

import { config } from '../config';

const dbConfig: Knex.Config =
  config.db.client === 'pg'
    ? {
        client: 'pg',
        connection: config.db.pg_connection,
        pool: { min: 2, max: 10 },
      }
    : {
        client: 'sqlite3',
        connection: { filename: config.db.sqlite_filename },
        useNullAsDefault: true,
      };

const db = knex(dbConfig);
export default db;
