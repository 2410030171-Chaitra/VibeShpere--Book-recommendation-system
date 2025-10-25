/*
Script: fill_covers.cjs
Purpose: Find book objects in App.jsx where `cover` is empty or points to a non-200 resource,
query Google Books for a thumbnail, and replace the `cover` value in App.jsx with the found thumbnail.

Run: node scripts/fill_covers.cjs
*/

const fs = require('fs');
const path = require('path');
const https = require('https');

const APP_PATH = path.join(__dirname, '..', 'App.jsx');

function existsAndOk(url) {
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: 'HEAD' }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on('error', () => resolve(false));
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
}

function fetchGoogleThumb(title, author) {
  return new Promise((resolve) => {
    try {
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
            const thumb = info && (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail));
            resolve(thumb ? thumb.replace(/^http:\/\//, 'https://') : null);
          } catch (e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    } catch (e) { resolve(null); }
  });
}

(async () => {
  const src = fs.readFileSync(APP_PATH, 'utf8');

  const bookRegex = /({\s*id:\s*"([^"]+)",[\s\S]*?title:\s*"([^"]+)",[\s\S]*?author:\s*"([^"]+)",[\s\S]*?cover:\s*"([^"]*)")/g;

  let match;
  let newSrc = src;
  const replaced = [];

  while ((match = bookRegex.exec(src)) !== null) {
    const fullMatch = match[1];
    const id = match[2];
    const title = match[3];
    const author = match[4];
    let cover = match[5];

    const needsFix = !cover || cover.trim() === "";

    if (!needsFix) {
      const ok = await existsAndOk(cover);
      if (ok) continue;
    }

    console.log(`Attempting to find cover for ${id} — ${title} by ${author}`);
    const thumb = await fetchGoogleThumb(title, author);
    if (thumb) {
      const oldSnippet = `cover: "${cover}"`;
      const newSnippet = `cover: "${thumb}"`;
      if (newSrc.includes(oldSnippet)) {
        newSrc = newSrc.replace(oldSnippet, newSnippet);
        replaced.push({ id, title, author, cover: thumb });
        console.log(` → Replaced cover for ${id} with Google Books thumbnail`);
      }
    } else {
      console.log(` → No Google thumbnail found for ${id}`);
    }
  }

  if (replaced.length > 0) {
    fs.writeFileSync(APP_PATH, newSrc, 'utf8');
    console.log('\nUpdated App.jsx with the following cover replacements:');
    replaced.forEach(r => console.log(` - ${r.id}: ${r.cover}`));
  } else {
    console.log('No replacements made. Either no missing/broken covers or no thumbnails found.');
  }
})();
