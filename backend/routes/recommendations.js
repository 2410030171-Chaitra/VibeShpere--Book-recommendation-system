const express = require('express');
const router = express.Router();

// In-memory cache (per-process) with TTL
const cache = new Map(); // key -> { t, v }
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key){
  const rec = cache.get(key);
  if(!rec) return null;
  if(Date.now() - rec.t > TTL_MS){
    cache.delete(key);
    return null;
  }
  return rec.v;
}
function setCached(key, v){ cache.set(key, { t: Date.now(), v }); }

const API_BASE = 'https://www.googleapis.com/books/v1/volumes?q=';

function normalizeImage(url){
  if(!url) return null;
  try { return url.replace(/^http:/,'https:'); } catch(e){ return url; }
}

function pickCover(info){
  const g = info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail;
  return normalizeImage(g || null);
}

function cleanItem(item){
  const info = item.volumeInfo || {};
  const cover = pickCover(info);
  if(!cover) return null;
  // Exclude explicit / mature-rated volumes reported by Google Books
  if (info.maturityRating && String(info.maturityRating).toUpperCase() === 'MATURE') return null;
  // Filter out 18+ books by keywords
  const adultKeywords = [
    'erotica', 'adult', 'explicit', '18+', 'nsfw', 'sex', 'sexual', 'porn', 'xxx', 'mature', 'smut', 'r18', 'r-18', 'bdsm', 'fetish', 'taboo', 'incest', 'hentai', 'yaoi', 'yuri', 'lgbt erotica', 'gay erotica', 'lesbian erotica'
  ];
  const text = [info.title, info.subtitle, info.description, ...(info.categories||[]), ...(info.subjects||[])]
    .join(' ').toLowerCase();
  if(adultKeywords.some(k => text.includes(k))) return null;
  // Runtime blocklist for specific titles/authors/ids
  const RUNTIME_BLOCKLIST = [ 'the ticket' ];
  const titleLower = (info.title || '').toLowerCase();
  const authorsLower = (info.authors || []).join(' ').toLowerCase();
  const idLower = (item.id || '').toLowerCase();
  if (RUNTIME_BLOCKLIST.some(b => !b ? false : titleLower.includes(b) || authorsLower.includes(b) || idLower.includes(b))) return null;
  return {
    id: item.id,
    title: info.title || 'Untitled',
    authors: info.authors || [],
    description: info.description || info.subtitle || '',
    cover,
    infoLink: info.infoLink || null,
    publishedDate: info.publishedDate || null
  };
}

async function fetchPage(q, startIndex=0, max=40){
  const url = API_BASE + encodeURIComponent(q) + `&startIndex=${startIndex}&maxResults=${max}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Upstream error');
  const json = await res.json();
  return (json.items || []);
}

async function fetchMany(q, total=120){
  const pages = Math.ceil(total/40);
  const reqs = [];
  for(let i=0;i<pages;i++) reqs.push(fetchPage(q, i*40, 40));
  const results = await Promise.all(reqs);
  return results.flat();
}

// Mood -> query keywords mapping
const MOOD_MAP = {
  happy: 'feel-good OR heartwarming',
  sad: 'poignant OR bittersweet',
  romantic: 'romance OR love story',
  adventurous: 'adventure OR action',
  cozy: 'cozy mystery OR wholesome',
  dark: 'dark fantasy OR noir',
  inspiring: 'inspirational OR uplifting'
};

// GET /api/recommendations/trending?limit=40
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit||'40',10), 200);
    const key = `trending:${limit}`;
    const c = getCached(key); if(c) return res.json(c);
    // Compose a broad query to get popular titles with covers from Google Books
    const q = 'bestsellers OR subject:fiction OR intitle:novel';
    const googlePool = await fetchMany(q, Math.max(limit*2, 80));
    const googleCleaned = googlePool.map(cleanItem).filter(Boolean);

    // Fetch trending books from Open Library (no API key needed)
    async function fetchOpenLibrary(limit) {
      const url = `https://openlibrary.org/subjects/bestsellers.json?limit=${limit}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const json = await res.json();
        const adultKeywords = [
          'erotica', 'adult', 'explicit', '18+', 'nsfw', 'sex', 'sexual', 'porn', 'xxx', 'mature', 'smut', 'r18', 'r-18', 'bdsm', 'fetish', 'taboo', 'incest', 'hentai', 'yaoi', 'yuri', 'lgbt erotica', 'gay erotica', 'lesbian erotica'
        ];
        return (json.works || [])
          .map(work => ({
            id: 'OL-' + work.key,
            title: work.title,
            authors: (work.authors || []).map(a => a.name),
            description: work.subject ? work.subject.join(', ') : '',
            cover: work.cover_id ? `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg` : null,
            infoLink: `https://openlibrary.org${work.key}`,
            publishedDate: work.first_publish_year || null
          }))
          .filter(b => !!b.cover && !adultKeywords.some(k => (b.title + ' ' + b.description).toLowerCase().includes(k)));
      } catch (e) {
        return [];
      }
    }

    const openLibBooks = await fetchOpenLibrary(limit);

    // Merge and deduplicate by title+author
    const allBooks = [...googleCleaned, ...openLibBooks];
    const seen = new Set();
    const unique = [];
    for (const it of allBooks) {
      const key = (it.title + '|' + (it.authors?.join(',') || '')).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(it);
      }
      if (unique.length >= limit) break;
    }
    setCached(key, unique);
    res.json(unique);
  } catch (e) {
    console.error('trending error', e);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// GET /api/recommendations/search?q=...&limit=...
router.get('/search', async (req, res) => {
  try {
    let { q = '', limit = '60' } = req.query;
    limit = Math.min(parseInt(limit,10)||60, 200);
    if(!q) q = 'bestsellers';
    // Author mapping: author:Name or by Name -> inauthor:Name
    const m = String(q).trim();
    let qq = m;
    const authorPrefix = m.match(/^author\s*:\s*(.+)$/i);
    const byPrefix = m.match(/^by\s+(.+)$/i);
    if(authorPrefix) qq = `inauthor:${authorPrefix[1]}`;
    else if(byPrefix) qq = `inauthor:${byPrefix[1]}`;
    // genre:Fantasy -> subject:Fantasy
    const genrePrefix = m.match(/^genre\s*:\s*(.+)$/i);
    if(genrePrefix) qq = `subject:${genrePrefix[1]}`;

    const key = `search:${qq}:${limit}`;
    const c = getCached(key); if(c) return res.json(c);
    const pool = await fetchMany(qq, Math.max(limit*2, 120));
    const cleaned = pool.map(cleanItem).filter(Boolean).slice(0, limit);
    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('search error', e);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /api/recommendations/discover?mood=happy&genre=fiction&limit=...
router.get('/discover', async (req, res) => {
  try {
    const { mood = '', genre = '', limit = '40' } = req.query;
    const lim = Math.min(parseInt(limit,10)||40, 200);
    const moodPart = MOOD_MAP[String(mood).toLowerCase()] || '';
    const genrePart = genre ? `subject:${genre}` : '';
    const parts = [moodPart, genrePart].filter(Boolean);
    const q = parts.length ? parts.join(' ') : 'bestsellers';
    const key = `discover:${mood}:${genre}:${lim}`;
    const c = getCached(key); if(c) return res.json(c);
    const pool = await fetchMany(q, Math.max(lim*3, 120));
    const cleaned = pool.map(cleanItem).filter(Boolean).slice(0, lim);
    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('discover error', e);
    res.status(500).json({ error: 'Failed to discover' });
  }
});

module.exports = router;
