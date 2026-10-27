const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

let sql;

function getSql() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is missing.");
    }
    sql = neon(connectionString);
  }
  return sql;
}

module.exports = {
  query: async (text, params) => {
    const sqlClient = getSql();
    // For conventional queries, use .query(text, params)
    const rows = await sqlClient.query(text, params);
    return { rows };
  },
  pool: {
    end: async () => {}
  }
};
