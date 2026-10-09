const { Pool } = require("pg");

const backendPool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.BACKEND_DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function backendQuery(text, params) {
  return backendPool.query(text, params);
}

module.exports = {
  backendPool,
  backendQuery
};