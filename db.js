// db.js now uses pg-pool to manage connections to a PostgreSQL database.
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.PG_URI,
});

module.exports = pool;
