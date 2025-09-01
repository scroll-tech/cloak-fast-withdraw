const { DB_CLIENT, SQLITE_FILENAME, PG_CONNECTION } = process.env;

const common = {
  migrations: {
    directory: './migrations',
  },
};

if (DB_CLIENT === 'pg') {
  module.exports = {
    client: 'pg',
    connection: PG_CONNECTION,
    ...common,
  };
} else {
  module.exports = {
    client: 'sqlite3',
    connection: {
      filename: SQLITE_FILENAME || './dev.sqlite',
    },
    useNullAsDefault: true,
    ...common,
  };
}
