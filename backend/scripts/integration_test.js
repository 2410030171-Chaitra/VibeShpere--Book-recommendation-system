#!/usr/bin/env node
require('dotenv').config();
const { spawnSync } = require('child_process');
const http = require('http');
const API_BASE = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 5001}`;

function httpRequest(method, path, body) {
  const url = new URL(path, API_BASE);
  const data = body ? JSON.stringify(body) : null;
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Accept': 'application/json'
    },
    timeout: 5000
  };
  if (data) {
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(data);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + e.message + '\n' + raw));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(new Error('Request timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('1) Running migrations...');
  const mig = spawnSync(process.execPath, ['scripts/run_migrations.js'], { cwd: __dirname + '/..', stdio: 'inherit' });
  if (mig.status !== 0) {
    console.error('Migrations failed (exit ' + mig.status + '). Aborting test.');
    process.exit(2);
  }

  try {
    console.log('2) POST /api/favorites');
    const post = await httpRequest('POST', '/api/favorites', { user_id: 1, book_id: 'b1' });
    if (post.status !== 200 || !post.body || !post.body.success) {
      console.error('POST failed:', post.status, post.body);
      process.exit(3);
    }
    console.log('   -> POST succeeded');

    console.log('3) GET /api/favorites/1');
    const get1 = await httpRequest('GET', '/api/favorites/1');
    if (get1.status !== 200 || !Array.isArray(get1.body)) {
      console.error('GET failed:', get1.status, get1.body);
      process.exit(4);
    }
    const contains = get1.body.some(b => String(b.id) === 'b1');
    if (!contains) {
      console.error('GET did not return the expected favorite. Body:', get1.body);
      process.exit(5);
    }
    console.log('   -> GET returned favorite');

    console.log('4) DELETE /api/favorites');
    const del = await httpRequest('DELETE', '/api/favorites', { user_id: 1, book_id: 'b1' });
    if (del.status !== 200 || !del.body || !del.body.success) {
      console.error('DELETE failed:', del.status, del.body);
      process.exit(6);
    }
    console.log('   -> DELETE succeeded');

    console.log('5) GET /api/favorites/1 (verify removal)');
    const get2 = await httpRequest('GET', '/api/favorites/1');
    if (get2.status !== 200 || !Array.isArray(get2.body)) {
      console.error('Final GET failed:', get2.status, get2.body);
      process.exit(7);
    }
    const still = get2.body.some(b => String(b.id) === 'b1');
    if (still) {
      console.error('Favorite still present after delete. Body:', get2.body);
      process.exit(8);
    }

    console.log('\nINTEGRATION TEST PASSED ✅');
    process.exit(0);
  } catch (err) {
    console.error('Integration test error:', err && err.message);
    process.exit(10);
  }
}

run();
