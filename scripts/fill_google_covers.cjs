/*
Script: fill_google_covers.cjs
- Scans App.jsx for book entries (title/author/cover)
- Queries Google Books API for thumbnails
- Replaces cover: "..." lines with the Google thumbnail when available

Run: node scripts/fill_google_covers.cjs
*/
const fs = require('fs');
const https = require('https');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '..', 'App.jsx');
const BACKUP_PATH = APP_PATH + '.bak';

function fetchGoogleThumbnail(title, author) {
  return new Promise((resolve) => {
    try {
      const q = encodeURIComponent(`intitle:${title}` + (author ? `+inauthor:${author}` : ''));
      const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`;
      https.get(url, (res) => {
        let s = '';
        res.on('data', (c) => s += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(s);
            const items = j.items || [];
            for (const item of items) {
              const info = item.volumeInfo || {};
              const links = info.imageLinks || {};
              const thumb = links.thumbnail || links.smallThumbnail;
              if (thumb) {
                // Prefer https
                const t = thumb.replace(/^http:\/\//, 'https://');
                resolve(t);
                return;
              }
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    } catch (e) {
      resolve(null);
    }
  });
}

(async function main() {
  console.log('Reading', APP_PATH);
  const content = fs.readFileSync(APP_PATH, 'utf8');
  fs.writeFileSync(BACKUP_PATH, content, 'utf8');
  console.log('Backup written to', BACKUP_PATH);

  // Regex to find book objects roughly: id:, title:, author:, cover: "...",
  // This is a best-effort parser for this specific file layout.
  const bookRegex = /\{\s*id:\s*"([^"]+)",\s*\n\s*title:\s*"([\s\S]*?)",\s*\n\s*author:\s*"([\s\S]*?)",[\s\S]*?cover:\s*"([^"]*)"/g;

  let m;
  const replacements = [];
  while ((m = bookRegex.exec(content)) !== null) {
    const [full, id, title, author, cover] = m;
    const cleanTitle = title.replace(/\n/g, ' ').trim();
    const cleanAuthor = author.replace(/\n/g, ' ').trim();
    replacements.push({ id, title: cleanTitle, author: cleanAuthor, cover, index: m.index });
  }

  console.log('Found', replacements.length, 'books to check');

  let newContent = content;
  let changed = 0;
  for (const r of replacements) {
    try {
      process.stdout.write(`Checking ${r.id} — ${r.title} by ${r.author} ... `);
      const thumb = await fetchGoogleThumbnail(r.title, r.author);
      if (thumb) {
        // If existing cover empty or contains 'images.unsplash' or tiny query, replace
        const shouldReplace = !r.cover || r.cover.trim() === '' || r.cover.includes('images.unsplash.com') || r.cover.length < 30;
        if (shouldReplace) {
          // Replace the first occurrence of cover: "<old>" after the book index
          const sliceStart = r.index;
          const slice = newContent.slice(sliceStart);
          const covRegex = /cover:\s*"([^"]*)"/;
          const covMatch = covRegex.exec(slice);
          if (covMatch) {
            const oldLine = covMatch[0];
            const newLine = `cover: "${thumb}"`;
            newContent = newContent.slice(0, sliceStart) + slice.replace(covRegex, newLine) + newContent.slice(sliceStart + slice.length);
            changed++;
            console.log('replaced');
            continue;
          }
        }
      }
      console.log('no good thumb');
    } catch (e) {
      console.log('err');
    }
  }

  if (changed > 0) {
    fs.writeFileSync(APP_PATH, newContent, 'utf8');
    console.log(`Updated ${changed} covers in App.jsx`);
  } else {
    console.log('No changes made');
  }

  console.log('Done. Restart your dev server to pick up changes.');
})();
