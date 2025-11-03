const mysql = require('mysql2/promise');
require('dotenv').config();

function buildDbConfig() {
  // Support both discrete env vars and a single DATABASE_URL.
  // DATABASE_URL format: mysql://user:pass@host:port/dbname?sslmode=require
  const url = process.env.DATABASE_URL;
  let cfg;
  if (url) {
    try {
      const u = new URL(url);
      cfg = {
        host: u.hostname || process.env.DB_HOST || 'localhost',
        user: decodeURIComponent(u.username || ''),
        password: decodeURIComponent(u.password || ''),
        database: (u.pathname || '').replace(/^\//, '') || process.env.DB_NAME,
        port: Number(u.port) || Number(process.env.DB_PORT) || 3306,
      };
      // Enable SSL if requested (common on hosted providers)
      const sslMode = u.searchParams.get('ssl') || u.searchParams.get('sslmode');
      if ((sslMode && sslMode !== 'disable') || process.env.DB_SSL === 'true' || process.env.RENDER) {
        cfg.ssl = { rejectUnauthorized: false };
      }
    } catch (e) {
      console.warn('DATABASE_URL parse failed, falling back to discrete env vars:', e.message);
    }
  }

  if (!cfg) {
    cfg = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT) || 3306,
    };
    if (process.env.DB_SSL === 'true' || process.env.RENDER) {
      cfg.ssl = { rejectUnauthorized: false };
    }
  }

  return {
    ...cfg,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
    queueLimit: 0,
  };
}

const dbConfig = buildDbConfig();
const pool = mysql.createPool(dbConfig);

// Test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

module.exports = { pool, testConnection };