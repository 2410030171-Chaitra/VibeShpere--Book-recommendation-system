#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const APP_FILE = path.join(ROOT, 'App.jsx');

if (!fs.existsSync(APP_FILE)) {
  console.error('App.jsx not found at', APP_FILE);
  process.exit(1);
}

const content = fs.readFileSync(APP_FILE, 'utf8');

// Match book object blocks that contain id, title, author and cover (cover may be empty)
const bookRe = /\{[^}]*?id\s*:\s*['\"](?<id>[^'\"]+)['\\"][^}]*?title\s*:\s*['\"](?<title>[^'\"]+)['\"][^}]*?author\s*:\s*['\"](?<author>[^'\"]+)['\"][^}]*?cover\s*:\s*['\"](?<cover>[^'\"]*)['\"][^}]*\}/gs;

function getGoogleThumbnail(title, author) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(`intitle:${title}` + (author ? `+inauthor:${author}` : ''));
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const item = json.items && json.items[0];
          const info = item && item.volumeInfo;
          const thumb = info && info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);
          if (thumb) resolve(thumb.replace(/^http:/, 'https:'));
          else resolve(null);
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

(async function main(){
  console.log('Scanning App.jsx for book entries with empty covers...');
  const matches = [...content.matchAll(bookRe)];
  if (!matches.length) {
    console.log('No matching book objects found. Exiting.');
    return;
  }

  let updatedContent = content;
  const changes = [];

  for (const m of matches) {
    const { id, title, author, cover } = m.groups;
    if (cover && cover.trim() !== '') continue; // only process blank covers
    console.log(`Looking up Google Books thumbnail for: ${title} — ${author}`);
    const thumb = await getGoogleThumbnail(title, author);
    if (thumb) {
      // Build a safer replacement: locate the exact cover: "" inside the matched block
      const block = m[0];
      const replacedBlock = block.replace(/cover\s*:\s*['\"]['\"]/, `cover: "${thumb}"`);
      if (replacedBlock !== block) {
        updatedContent = updatedContent.replace(block, replacedBlock);
        changes.push({ id, title, author, thumb });
        console.log(`  → Found thumbnail: ${thumb}`);
      }
    } else {
      console.log('  → No thumbnail found');
    }
  }

  if (changes.length) {
    // Backup App.jsx
    const bak = APP_FILE + '.autofill.bak';
    fs.writeFileSync(bak, content, 'utf8');
    fs.writeFileSync(APP_FILE, updatedContent, 'utf8');
    console.log(`
Wrote ${changes.length} changes to App.jsx. Backup saved to ${path.basename(bak)}.`);
    console.log('Changes:');
    changes.forEach(c => console.log(` - ${c.id}: ${c.title} → ${c.thumb}`));
  } else {
    console.log('No changes made (no thumbnails found for blank covers).');
  }
})();
