#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const APP_FILE = path.join(ROOT, 'App.jsx');
if (!fs.existsSync(APP_FILE)) { console.error('App.jsx not found'); process.exit(1); }
const CONTENT_THRESHOLD = 30 * 1024; // 30 KB

function headUrl(url, timeout = 8000) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) { return resolve(null); }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(parsed, { method: 'HEAD', timeout }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function getGoogleThumbnail(title, author) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(`intitle:${title}` + (author ? `+inauthor:${author}` : ''));
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const item = json.items && json.items[0];
          const info = item && item.volumeInfo;
          const thumb = info && info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);
          resolve(thumb ? thumb.replace(/^http:/,'https:') : null);
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const content = fs.readFileSync(APP_FILE, 'utf8');
const bookRe = /\{[^}]*?id\s*:\s*['\"](?<id>[^'\"]+)['\"][^}]*?title\s*:\s*['\"](?<title>[^'\"]+)['\"][^}]*?author\s*:\s*['\"](?<author>[^'\"]+)['\"][^}]*?cover\s*:\s*['\"](?<cover>[^'\"]*)['\"][^}]*\}/gs;

(async function main(){
  console.log('Scanning App.jsx for covers to evaluate...');
  const matches = [...content.matchAll(bookRe)];
  if (!matches.length) { console.log('No book entries found'); process.exit(0); }

  let updated = content;
  const changes = [];

  for (const m of matches) {
    const { id, title, author, cover } = m.groups;
    if (!cover || cover.trim() === '') continue; // skip blank (handled by other script)
    if (cover.startsWith('data:') || cover.includes('googleapis.com')) continue; // skip data/google

    // Use HEAD to inspect Content-Length
    const head = await headUrl(cover.replace(/^http:/,'https:'));
    if (!head || !head.headers) continue;
    const status = head.status;
    if (status < 200 || status >= 400) continue;
    const len = parseInt(head.headers['content-length'] || '0', 10) || 0;
    if (len > 0 && len < CONTENT_THRESHOLD) {
      console.log(`Low-content-length cover detected for '${title}' (${len} bytes). Trying Google Books...`);
      const thumb = await getGoogleThumbnail(title, author);
      if (thumb) {
        const block = m[0];
        const replaced = block.replace(/cover\s*:\s*['\"][^'\"]*['\"]/,'cover: "' + thumb + '"');
        if (replaced !== block) {
          updated = updated.replace(block, replaced);
          changes.push({ id, title, old: cover, new: thumb, size: len });
          console.log(`  → replaced with Google thumbnail: ${thumb}`);
        }
      } else {
        console.log('  → no Google thumbnail found');
      }
    }
  }

  if (changes.length) {
    const bak = APP_FILE + '.autofill_lowres.bak';
    fs.writeFileSync(bak, content, 'utf8');
    fs.writeFileSync(APP_FILE, updated, 'utf8');
    console.log(`\nWrote ${changes.length} replacements to App.jsx (backup: ${path.basename(bak)})`);
    changes.forEach(c => console.log(` - ${c.title}: ${c.size} bytes -> ${c.new}`));
  } else {
    console.log('No low-res covers required replacement.');
  }
})();
