/*
Script: fill_covers.js
Purpose: Find book objects in App.jsx where `cover` is empty or points to a non-200 resource,
query Google Books for a thumbnail, and replace the `cover` value in App.jsx with the found thumbnail.

Run: node scripts/fill_covers.js
*/

const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(__dirname, '..', 'App.jsx');

async function existsAndOk(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function fetchGoogleThumb(title, author) {
  try {
    const q = encodeURIComponent(`intitle:${title}` + (author ? `+inauthor:${author}` : ''));
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.items && json.items[0];
    const info = item && item.volumeInfo;
    const thumb = info && (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail));
    return thumb ? thumb.replace(/^http:\/\//, 'https://') : null;
  } catch (e) {
    return null;
  }
}

(async () => {
  const src = fs.readFileSync(APP_PATH, 'utf8');

  // Regex to capture book object header up through cover property.
  // We'll iterate matches and replace cover when needed.
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
      // check remote status
      const ok = await existsAndOk(cover);
      if (ok) continue;
    }

    console.log(`Attempting to find cover for ${id} — ${title} by ${author}`);
    const thumb = await fetchGoogleThumb(title, author);
    if (thumb) {
      // Build replacement: replace the cover: "..." within the matched block
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
