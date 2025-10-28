require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');

/**
 * Migration runner with tracking table.
 * - creates `migrations` table if missing
 * - skips files already recorded in the table
 * - runs each SQL file in lexical order inside a transaction
 */
async function ensureMigrationsTable(conn) {
  const create = `
    CREATE TABLE IF NOT EXISTS migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(128) DEFAULT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await conn.query(create);
  // ensure checksum column exists on older installs (MySQL >=8 supports IF NOT EXISTS)
  try {
    await conn.query("ALTER TABLE migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(128) DEFAULT NULL");
  } catch (e) {
    // If ALTER with IF NOT EXISTS isn't supported, ignore errors (we'll handle missing column later)
  }
}

function fileChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found at', migrationsDir);
    process.exit(0);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migration files to run.');
    process.exit(0);
  }

  console.log('Found migrations:', files);

  const conn = await pool.getConnection();
  try {
    // ensure tracking table exists
    await ensureMigrationsTable(conn);

  // fetch applied migration names and checksums (fallback to names-only if checksum column missing)
    let appliedRows;
    let applied = new Map();
    try {
      [appliedRows] = await conn.query('SELECT name, checksum FROM migrations');
      applied = new Map(appliedRows.map(r => [r.name, r.checksum]));
    } catch (err) {
      // checksum column may be missing on older installs; fall back to name-only
      const [nameRows] = await conn.query('SELECT name FROM migrations');
      applied = new Map(nameRows.map(r => [r.name, null]));
    }

    // If checksum column was not present earlier, try to add it now (some MySQL versions support IF NOT EXISTS)
    try {
      await conn.query("ALTER TABLE migrations ADD COLUMN checksum VARCHAR(128) DEFAULT NULL");
    } catch (e) {
      // ignore errors (column may already exist or server doesn't support ALTER ADD IF NOT EXISTS)
    }

    // For any already-applied migrations with null checksum, compute and populate it so future runs can validate
    for (const [name, storedChecksum] of applied.entries()) {
      if (storedChecksum) continue;
      try {
        const full = path.join(migrationsDir, name);
        if (!fs.existsSync(full)) continue; // can't compute
        const sql = fs.readFileSync(full, 'utf8');
        const checksum = fileChecksum(sql);
        await conn.query('UPDATE migrations SET checksum = ? WHERE name = ?', [checksum, name]);
        // update local map
        applied.set(name, checksum);
        console.log('Backfilled checksum for applied migration:', name);
      } catch (e) {
        // non-fatal; continue
        console.warn('Failed to backfill checksum for', name, '-', e && e.message);
      }
    }

    for (const file of files) {
      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, 'utf8');
      const checksum = fileChecksum(sql);

      if (applied.has(file)) {
        const recorded = applied.get(file);
        if (recorded && recorded !== checksum) {
          console.error('\nERROR: Migration file was modified after being applied:', file);
          console.error('  recorded checksum:', recorded);
          console.error('  current  checksum:', checksum);
          console.error('If you need to change a migration, create a new migration file instead of editing an applied one.');
          throw new Error('Detected modified migration: ' + file);
        }
        console.log('Skipping already-applied migration:', file);
        continue;
      }
      console.log('Running migration:', file);

      try {
        await conn.beginTransaction();
        // execute the migration SQL
        await conn.query(sql);
        // record it with checksum
        await conn.query('INSERT INTO migrations (name, checksum) VALUES (?, ?)', [file, checksum]);
        await conn.commit();
        console.log('OK:', file);
      } catch (err) {
        await conn.rollback().catch(() => {});
        console.error('Migration failed for', file, '-', err && err.message);
        throw err;
      }
    }

    console.log('All migrations applied.');
  } catch (err) {
    console.error('Migration runner failed:', err && err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    // allow process to exit
    pool.end().catch(()=>{});
  }
}

run().catch(err => {
  console.error('Unexpected error while running migrations:', err && err.message);
  process.exit(1);
});
