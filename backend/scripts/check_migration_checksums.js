#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');

function fileChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

(async function main() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[migrations-check] No migrations directory, skipping.');
      process.exit(0);
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    if (files.length === 0) {
      console.log('[migrations-check] No migration files found, skipping.');
      process.exit(0);
    }

    // Try to get a connection - if DB not reachable, skip check (do not block commit)
    let conn;
    try {
      conn = await pool.getConnection();
    } catch (err) {
      console.log('[migrations-check] DB not reachable, skipping checksum check.\n', err && err.message);
      process.exit(0);
    }

    let appliedRows;
    try {
      [appliedRows] = await conn.query('SELECT name, checksum FROM migrations');
    } catch (err) {
      console.log('[migrations-check] migrations table missing or not accessible, skipping check.');
      conn.release();
      process.exit(0);
    }

    const applied = new Map(appliedRows.map(r => [r.name, r.checksum]));

    const mismatches = [];
    for (const file of files) {
      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, 'utf8');
      const checksum = fileChecksum(sql);
      if (applied.has(file)) {
        const recorded = applied.get(file);
        if (recorded && recorded !== checksum) {
          mismatches.push({ file, recorded, checksum });
        }
      }
    }

    if (mismatches.length === 0) {
      // Nothing to warn about
      conn.release();
      process.exit(0);
    }

    console.log('\n=== ERROR: Detected modified migration files ===');
    mismatches.forEach(m => {
      console.log('\nMigration:', m.file);
      console.log('  recorded checksum:', m.recorded);
      console.log('  current  checksum:', m.checksum);
    });
    console.log('\nEditing applied migrations is not allowed. Create a new migration file instead.');
    conn.release();
    // Exit non-zero so the pre-commit hook blocks the commit
    process.exit(1);
  } catch (err) {
    console.log('[migrations-check] Unexpected error (non-blocking):', err && err.message);
    process.exit(0);
  }
})();
