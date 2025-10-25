const express = require('express');
const axios = require('axios');
const router = express.Router();

// In-memory cache (per-process) with TTL
const cache = new Map(); // key -> { t, v }
const TTL_MS = 30 * 60 * 1000; // 30 minutes for better performance

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

// Mood to search query mapping with intelligent AI-like recommendations
const MOOD_TO_QUERY_MAP = {
  happy: ['subject:humor', 'subject:comedy', 'uplifting stories', 'feel-good fiction'],
  sad: ['emotional stories', 'subject:drama', 'tear-jerker', 'moving fiction'],
  romantic: ['subject:romance', 'love stories', 'romantic fiction', 'contemporary romance'],
  adventurous: ['subject:adventure', 'action fiction', 'thriller', 'quest stories'],
  mysterious: ['subject:mystery', 'detective stories', 'crime fiction', 'suspense'],
  inspiring: ['motivational', 'subject:biography', 'inspiring stories', 'self-help'],
  calm: ['peaceful reads', 'cozy fiction', 'gentle stories', 'meditation'],
  dark: ['subject:thriller', 'psychological fiction', 'dark fantasy', 'noir'],
  fantastical: ['subject:fantasy', 'magical realism', 'science fiction', 'epic fantasy'],
  thoughtful: ['subject:philosophy', 'literary fiction', 'contemplative', 'intellectual']
};

// Genre refinement queries
const GENRE_QUERIES = {
  fiction: 'subject:fiction',
  nonfiction: 'subject:nonfiction',
  mystery: 'subject:mystery',
  romance: 'subject:romance',
  fantasy: 'subject:fantasy',
  sciencefiction: 'subject:science+fiction',
  'science fiction': 'subject:science+fiction',
  thriller: 'subject:thriller',
  horror: 'subject:horror',
  biography: 'subject:biography',
  history: 'subject:history',
  selfhelp: 'subject:self-help',
  'self-help': 'subject:self-help',
  business: 'subject:business',
  poetry: 'subject:poetry',
  drama: 'subject:drama',
  comedy: 'subject:comedy'
};

const API_BASE = 'https://www.googleapis.com/books/v1/volumes?q=';

function normalizeImage(url){
  if(!url) return null;
  try { 
    // Force HTTPS
    let improved = url.replace(/^http:/,'https:');
    // Keep the original zoom=1 and add edge=curl for better availability
    if (!improved.includes('zoom=')) {
      improved = improved.replace('&source=', '&zoom=1&source=');
    }
    return improved;
  } catch(e){ return url; }
}

function bestIsbn(info){
  const ids = (info && info.industryIdentifiers) || [];
  const i13 = ids.find(x=>x.type==='ISBN_13')?.identifier;
  const i10 = ids.find(x=>x.type==='ISBN_10')?.identifier;
  return i13 || i10 || null;
}

function pickCover(info){
  // Try to get the best quality image available
  const images = info?.imageLinks || {};
  // Prefer larger images first
  let cover = images.large || images.medium || images.thumbnail || images.smallThumbnail;
  
  // If no Google Books cover, try Open Library as fallback (without default=false)
  if (!cover) {
    const isbn = bestIsbn(info);
    if (isbn) {
      // Open Library will show a generic placeholder if cover doesn't exist
      cover = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
    }
  }
  
  return normalizeImage(cover || null);
}

function cleanItem(item){
  const info = item.volumeInfo || {};
  const cover = pickCover(info);
  // Keep all books, even without covers (frontend will show placeholder)
  return {
    id: item.id,
    title: info.title || 'Untitled',
    authors: info.authors || ['Unknown Author'],
    author: (info.authors || ['Unknown Author']).join(', '),
    description: info.description || info.subtitle || 'No description available.',
    cover,
    thumbnail: cover,
    infoLink: info.infoLink || `https://www.google.com/search?q=${encodeURIComponent(info.title)}`,
    publishedDate: info.publishedDate || null,
    publisher: info.publisher || null,
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    averageRating: info.averageRating || 0,
    ratingsCount: info.ratingsCount || 0,
    isbn: bestIsbn(info)
  };
}

async function fetchPage(q, startIndex=0, max=40){
  // Use standard parameters that work reliably with Google Books API
  const url = API_BASE + encodeURIComponent(q) + `&startIndex=${startIndex}&maxResults=${max}&printType=books`;
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data.items || [];
  } catch (error) {
    console.error(`Error fetching page for "${q}":`, error.message);
    return [];
  }
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
    // Compose a broad query to get popular titles with covers
    const q = 'bestsellers OR subject:fiction OR intitle:novel';
    const pool = await fetchMany(q, Math.max(limit*3, 120));
    const cleaned = pool.map(cleanItem).filter(Boolean);
    const unique = [];
    const seen = new Set();
    for(const it of cleaned){ if(!seen.has(it.id)){ seen.add(it.id); unique.push(it);} if(unique.length>=limit) break; }
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
    
    const m = String(q).trim();
    let qq = m;
    let isAuthorSearch = false;
    let authorName = '';
    
    // Check if already formatted (inauthor:, intitle:, subject:)
    if (m.startsWith('inauthor:')) {
      qq = m;
      isAuthorSearch = true;
      authorName = m.replace('inauthor:', '').trim();
    }
    else if (m.startsWith('intitle:') || m.startsWith('subject:')) {
      qq = m;
    }
    // Explicit author prefixes: author:Name or by Name -> inauthor:Name
    else if (m.match(/^author\s*:\s*(.+)$/i)) {
      const match = m.match(/^author\s*:\s*(.+)$/i);
      authorName = match[1];
      qq = `inauthor:${authorName}`;
      isAuthorSearch = true;
    }
    else if (m.match(/^by\s+(.+)$/i)) {
      const match = m.match(/^by\s+(.+)$/i);
      authorName = match[1];
      qq = `inauthor:${authorName}`;
      isAuthorSearch = true;
    }
    // genre:Fantasy -> subject:Fantasy
    else if (m.match(/^genre\s*:\s*(.+)$/i)) {
      const match = m.match(/^genre\s*:\s*(.+)$/i);
      qq = `subject:${match[1]}`;
    }
    // For multi-word queries that look like book titles, use intitle: for better results
    else if (m.split(' ').length >= 2 && !m.match(/^\d+$/)) {
      qq = `intitle:${m}`;
    }
    // Otherwise use as-is
    else {
      qq = m;
    }

    const key = `search:${qq}:${limit}`;
    const c = getCached(key); if(c) return res.json(c);
    
    // Fetch extra books to ensure enough after filtering - increased for better coverage
    const fetchAmount = Math.max(limit*3, 200); // Increased from 120 to 200
    const pool = await fetchMany(qq, fetchAmount);
    let cleaned = pool.map(cleanItem).filter(Boolean);
    
    // For explicit author searches, strictly filter to only books BY that author
    if (isAuthorSearch && authorName) {
      const authorLower = authorName.toLowerCase();
      cleaned = cleaned.filter(book => {
        const bookAuthors = book.authors || [];
        return bookAuthors.some(author => {
          const authorNameLower = String(author || '').toLowerCase();
          // Match full name or last name
          return authorNameLower.includes(authorLower) || 
                 authorLower.split(' ').some(part => part.length > 2 && authorNameLower.includes(part));
        });
      });
    }
    
    const results = cleaned.slice(0, limit);
    setCached(key, results);
    res.json(results);
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
    
    // Use the comprehensive mood mapping
    const moodQueries = MOOD_TO_QUERY_MAP[String(mood).toLowerCase()] || [];
    const genreQuery = GENRE_QUERIES[String(genre).toLowerCase().replace(/\s+/g, '')] || '';
    
    let queries = [];
    if (moodQueries.length > 0) {
      queries = moodQueries;
      // Add genre filter if provided
      if (genreQuery) {
        queries = queries.map(q => `${q}+${genreQuery}`);
      }
    } else if (genreQuery) {
      queries = [genreQuery];
    } else {
      queries = ['bestsellers'];
    }
    
    const key = `discover:${mood}:${genre}:${lim}`;
    const c = getCached(key); 
    if(c) return res.json({ success: true, mood, genre, count: c.length, books: c });
    
    // Fetch from multiple queries and combine - increase pool to get more books with covers
    const allBooks = [];
    for (const q of queries) {
      if (allBooks.length >= lim * 3) break; // Get 3x more to filter for covers
      const pool = await fetchMany(q, 120); // Increased from 80 to 120
      const cleaned = pool.map(cleanItem).filter(Boolean);
      allBooks.push(...cleaned);
    }
    
    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for(const book of allBooks){ 
      if(!seen.has(book.id)){ 
        seen.add(book.id); 
        unique.push(book);
      } 
      if(unique.length >= lim) break; 
    }
    
    const result = unique.slice(0, lim);
    setCached(key, result);
    res.json({ success: true, mood, genre, count: result.length, books: result });
  } catch (e) {
    console.error('discover error', e);
    res.status(500).json({ success: false, error: 'Failed to discover books' });
  }
});

module.exports = router;
