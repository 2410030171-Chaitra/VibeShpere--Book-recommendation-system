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
    publishedDate: info.publishedDate || null,
    averageRating: info.averageRating || 0,
    categories: info.categories || []
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

// Lightweight Open Library search for broader coverage (no API key)
async function fetchOpenLibrarySearch(q, limit = 100){
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}`;
    const res = await fetch(url);
    if(!res.ok) return [];
    const json = await res.json();
    return (json.docs || []).map(d => {
      const cover = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null;
      return {
        id: `OL-${d.key || d.seed || (d.title_suggest||d.title)}`,
        title: d.title || d.title_suggest || 'Untitled',
        authors: (d.author_name || []),
        description: (d.subject && d.subject.join(', ')) || d.first_sentence || '',
        cover,
        infoLink: d.key ? `https://openlibrary.org${d.key}` : null,
        publishedDate: d.first_publish_year || null,
        averageRating: 0,
        categories: d.subject || []
      };
    }).filter(b => !!b.cover);
  } catch (e) {
    return [];
  }
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
    const key = `discover_ai:${mood}:${genre}:${lim}`;
    const c = getCached(key); if(c) return res.json(c);

    // Fetch candidates from Google Books and Open Library in parallel
    const googlePromise = fetchMany(q, Math.max(lim*3, 120));
    const openLibPromise = fetchOpenLibrarySearch(`${mood} ${genre}`.trim(), Math.max(lim*2, 80));
    const [googlePool, openLibBooks] = await Promise.all([googlePromise, openLibPromise]);

    const candidates = [];
    // Clean Google items
    for (const it of (googlePool || [])) {
      const citem = cleanItem(it);
      if (citem) candidates.push(citem);
    }
    // Add Open Library items (already cleaned by fetchOpenLibrarySearch)
    for (const ob of (openLibBooks || [])) {
      // attempt to filter adult keywords similarly
      const text = (ob.title + ' ' + (ob.description||'') + ' ' + (ob.categories||[]).join(' ')).toLowerCase();
      const adultKeywords = ['erotica','adult','explicit','18+','nsfw','sex','porn','xxx','mature','smut','r18','bdsm','fetish','taboo','incest','hentai'];
      if (adultKeywords.some(k => text.includes(k))) continue;
      candidates.push(ob);
    }

    // Deduplicate by title+authors
    const seen = new Set();
    const unique = [];
    for (const it of candidates) {
      const keyId = (it.title + '|' + (it.authors?.join(',')||'')).toLowerCase();
      if (seen.has(keyId)) continue;
      seen.add(keyId);
      unique.push(it);
    }

    // Scoring: relevance to mood/genre, rating, and recency
    const moodTerms = (moodPart || mood || '').toLowerCase().split(/\s+|OR/).filter(Boolean);
    const genreTerm = (genre || '').toLowerCase();
    const nowYear = new Date().getFullYear();

    function scoreItem(it){
      let score = 0;
      const text = ((it.title||'') + ' ' + (it.description||'') + ' ' + (it.categories||[]).join(' ') + ' ' + (it.authors||[]).join(' ')).toLowerCase();
      // mood term matches
      for (const t of moodTerms){ if (!t) continue; if (text.includes(t)) score += 4; }
      // genre match
      if (genreTerm && ((it.categories||[]).join(' ').toLowerCase().includes(genreTerm) || (it.title||'').toLowerCase().includes(genreTerm))) score += 3;
      // rating boost
      score += (it.averageRating || 0) * 1.5;
      // recency: newer books get a small boost
      if (it.publishedDate){
        const year = parseInt((it.publishedDate||'').toString().slice(0,4),10);
        if (!Number.isNaN(year)){
          const age = Math.max(0, nowYear - year);
          score += Math.max(0, 3 - (age / 5)); // recent books within ~15 years get diminishing boost
        }
      }
      // slight length penalty for very short descriptions (prefer richer metadata)
      if ((it.description||'').length > 200) score += 1;
      return score;
    }

    const scored = unique.map(it => ({...it, _score: scoreItem(it)})).sort((a,b)=>b._score - a._score).slice(0, lim);
    setCached(key, scored);
    res.json(scored);
  } catch (e) {
    console.error('discover error', e);
    res.status(500).json({ error: 'Failed to discover' });
  }
});

module.exports = router;
