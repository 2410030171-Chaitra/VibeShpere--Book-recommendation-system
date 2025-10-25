#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const FILES_TO_SCAN = [
  path.join(ROOT, 'App.jsx'),
  path.join(ROOT, 'App.jsx.bak'),
  path.join(ROOT, 'backend', 'seed.js')
].filter(p => fs.existsSync(p));

function extractCovers(content) {
  const lines = content.split(/\r?\n/);
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/cover\s*:\s*(?:([`'"])(.*?)\1|(null|undefined))/);
    if (m) {
      const cover = m[2] !== undefined ? m[2] : (m[3] || '');
      // look back for a title on nearby lines
      let title = null;
      for (let j = Math.max(0, i - 6); j <= i + 1; j++) {
        if (!lines[j]) continue;
        const mt = lines[j].match(/title\s*:\s*([`'"])(.*?)\1/);
        if (mt) { title = mt[2]; break; }
      }
      results.push({ line: i + 1, cover: cover.trim(), title });
    }
  }
  return results;
}

function checkUrl(urlStr, timeout = 10000) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch (e) { return resolve({ ok: false, status: 'invalid url', error: String(e) }); }
    const client = parsed.protocol === 'https:' ? https : http;
    const options = { method: 'HEAD', timeout };
    const req = client.request(parsed, options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) return resolve({ ok: true, status: res.statusCode });
      // some servers block HEAD; try GET as fallback
      if (res.statusCode === 405 || res.statusCode === 403 || res.statusCode === 400) {
        req.destroy();
        return tryGet(parsed, timeout, resolve);
      }
      return resolve({ ok: false, status: res.statusCode });
    });
    req.on('error', async (err) => {
      // try GET fallback
      tryGet(parsed, timeout, resolve, String(err));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'timeout' }); });
    req.end();
  });
}

function tryGet(parsed, timeout, resolve, prevErr) {
  return new Promise((r) => {
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, { timeout }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) return resolve({ ok: true, status: res.statusCode });
      return resolve({ ok: false, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, status: 'error', error: String(err), prev: prevErr }));
    req.on('timeout', () => resolve({ ok: false, status: 'timeout' }));
  });
}

(async function main(){
  console.log('Scanning files for cover entries...');
  const all = [];
  for (const f of FILES_TO_SCAN) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const covers = extractCovers(content).map(c => ({ file: path.relative(ROOT, f), ...c }));
      all.push(...covers);
    } catch (e) {
      console.error('Failed to read', f, e && e.message);
    }
  }

  if (all.length === 0) {
    console.log('No cover: entries found in the scanned files.');
    process.exit(0);
  }

  const missing = all.filter(x => !x.cover || x.cover === 'null' || x.cover === 'undefined');
  const candidates = all.filter(x => x.cover && x.cover !== 'null' && x.cover !== 'undefined');

  console.log('\nSummary:');
  console.log(`  scanned files: ${FILES_TO_SCAN.length}`);
  console.log(`  total cover entries found: ${all.length}`);
  console.log(`  missing/empty cover entries: ${missing.length}`);
  if (missing.length) {
    console.log('\nMissing covers (file:line - title if available):');
    missing.forEach(m => console.log(`  - ${m.file}:${m.line} ${m.title ? '– ' + m.title : ''}`));
  }

  console.log('\nChecking remote cover URLs (this may take a few seconds)...\n');

  const results = [];
  for (const c of candidates) {
    const url = c.cover;
    // Skip data: urls
    if (url.startsWith('data:')) {
      results.push({ ...c, ok: true, status: 'data-url' });
      continue;
    }
    // ensure https if possible
    let testUrl = url;
    if (testUrl.startsWith('http:')) testUrl = testUrl.replace(/^http:/,'https:');
    try {
      const r = await checkUrl(testUrl);
      results.push({ ...c, ok: !!r.ok, status: r.status, error: r.error });
    } catch (e) {
      results.push({ ...c, ok: false, status: 'exception', error: String(e) });
    }
  }

  const bad = results.filter(r => !r.ok);
  const good = results.filter(r => r.ok);

  console.log(`\nRemote check results: ${good.length} OK, ${bad.length} FAIL`);
  if (bad.length) {
    console.log('\nFailed or problematic URLs:');
    bad.forEach(b => console.log(`  - ${b.file}:${b.line} ${b.title ? '– ' + b.title : ''}\n      ${b.cover}\n      status: ${b.status}${b.error ? ' error: ' + b.error : ''}`));
  }

  if (good.length) {
    console.log('\nSample OK URLs (first 10):');
    good.slice(0,10).forEach(g => console.log(`  - ${g.file}:${g.line} ${g.title ? '– ' + g.title : ''} (${g.status})`));
  }

  // Save a short report
  const report = { scannedFiles: FILES_TO_SCAN.map(p=>path.relative(ROOT,p)), total: all.length, missingCount: missing.length, badCount: bad.length, bad, goodCount: good.length };
  fs.writeFileSync(path.join(ROOT,'scripts','cover_check_report.json'), JSON.stringify(report, null, 2));
  console.log('\nWrote scripts/cover_check_report.json with details.');
  process.exit(0);
})();
