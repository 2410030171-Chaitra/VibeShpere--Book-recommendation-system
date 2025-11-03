/**
 * Recommendations Service
 * 
 * Connects to backend API for AI-powered book recommendations
 * Fetches books from Google Books API + Open Library via backend
 * No API keys required
 */

import apiService from './api';
import fetchBooks, { fetchBooksMany } from './googleBooks';

// When using Vite dev server, the proxy handles "/api"; when using
// vite preview/production (no proxy), apiService points to the backend
// (http://localhost:3001/api by default or window.__API_BASE_URL__).
// To work seamlessly in both, we build endpoints without the leading
// "/api" and always go through apiService.
const API_BASE = '/recommendations';

// Local mood keywords (client-side fallback). Keep in sync with backend semantics.
const MOOD_KEYWORDS = {
  positive: ['feel-good', 'heartwarming', 'uplifting', 'humor', 'inspirational', 'motivational', 'subject:poetry'],
  emotional: ['grief', 'loss', 'healing', 'poignant', 'bittersweet', 'introspective', 'memoir', 'subject:memoir'],
  energetic: ['adventure', 'travel', 'survival', 'epic quest', 'fantasy adventure', 'mystery', 'thriller', 'suspense'],
  calm: ['soothing', 'gentle', 'quiet', 'reflective', 'meditative', 'comfort read', 'cozy'],
  tech: ['technology', 'programming', 'software', 'computer science', 'ai', 'machine learning', 'data science', 'innovation'],
  feelgood: ['wholesome', 'hopeful', 'uplifting fiction', 'lighthearted', 'cozy mystery', 'romcom']
};

function buildQueryFromMoodGenre(mood, genre) {
  const parts = [];
  if (mood && MOOD_KEYWORDS[mood]) {
    const kws = MOOD_KEYWORDS[mood];
    // Join multiple keywords with OR-like behavior to broaden results
    parts.push(kws.join(' '));
  }
  if (genre && genre !== 'all') {
    parts.push(`subject:${genre}`);
  }
  const q = parts.join(' ').trim() || 'bestsellers';
  return q;
}

function normalizeFromGoogleItem(item) {
  const info = item?.volumeInfo || {};
  const cover = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;
  return {
    id: item?.id || `book-${Date.now()}-${Math.random()}`,
    title: info.title || 'Untitled',
    author: Array.isArray(info.authors) ? info.authors.join(', ') : (info.authors || 'Unknown'),
    authors: Array.isArray(info.authors) ? info.authors : [info.authors || 'Unknown'],
    cover: cover || '/assets/default_cover.svg',
    thumbnail: cover || '/assets/default_cover.svg',
    description: info.description || info.subtitle || 'No description available.',
    averageRating: info.averageRating || 0,
    infoLink: info.infoLink || null,
    publishedDate: info.publishedDate || null,
    categories: info.categories || []
  };
}

/**
 * Helper: Call backend API with error handling
 */
async function callApi(path, params = {}) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `${API_BASE}${path}${queryString ? `?${queryString}` : ''}`;
    const data = await apiService.request(endpoint);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    // Silently allow callers to fallback to client mode
    return [];
  }
}

/**
 * Normalize backend response to consistent format
 */
function normalizeBackendItem(item) {
  return {
    id: item.id || `book-${Date.now()}-${Math.random()}`,
    title: item.title || 'Untitled',
    author: Array.isArray(item.authors) ? item.authors.join(', ') : (item.authors || 'Unknown'),
    authors: Array.isArray(item.authors) ? item.authors : [item.authors || 'Unknown'],
    cover: item.cover || '/assets/default_cover.svg',
    thumbnail: item.cover || '/assets/default_cover.svg',
    description: item.description || 'No description available.',
    averageRating: item.averageRating || 0,
    infoLink: item.infoLink || null,
    publishedDate: item.publishedDate || null,
    categories: item.categories || []
  };
}

/**
 * Get AI-powered recommendations based on mood and genre
 * 
 * @param {string} mood - User's current mood (happy, sad, romantic, etc.)
 * @param {string} genre - Book genre filter (fiction, mystery, fantasy, etc.)
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of recommended books
 */
export async function getRecommendations(mood = '', genre = '', limit = 40, seed = undefined) {
  // Try backend first
  const params = {};
  if (mood) params.mood = mood;
  if (genre && genre !== 'all') params.genre = genre;
  if (limit) params.limit = limit;
  if (seed !== undefined && seed !== null && seed !== '') params.seed = String(seed);
  const items = await callApi('/discover', params);
  if (items && items.length) return items.map(normalizeBackendItem);

  // Client-side fallback using Google Books
  const q = buildQueryFromMoodGenre(mood, genre);
  const pool = await fetchBooksMany(q, Math.max(120, limit * 3));
  let list = pool.map(normalizeFromGoogleItem);
  // Deterministic shuffle with seed (simple LCG-based for consistency)
  const s = Number.isFinite(Number(seed)) ? Number(seed) : Date.now();
  let x = (s % 2147483647);
  if (x <= 0) x += 2147483646;
  list = list.slice();
  for (let i = list.length - 1; i > 0; i--) {
    x = (x * 48271) % 2147483647;
    const j = x % (i + 1);
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
  }
  return list.slice(0, limit);
}

/**
 * Get currently trending books
 * 
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of trending books
 */
export async function getTrendingBooks(opts = {}) {
  // Support legacy usage getTrendingBooks(20)
  let limit = 40; let country;
  if (typeof opts === 'number') {
    limit = opts;
  } else if (opts && typeof opts === 'object') {
    limit = opts.limit ?? 40;
    country = opts.country;
  }
  const params = { limit };
  if (country) params.country = country;
  const items = await callApi('/trending', params);
  if (items && items.length) return items.map(normalizeBackendItem);

  // Client-side fallback: query broad popular topics
  const queries = [
    'bestsellers',
    'award winning novels',
    'popular fiction',
    'mystery thriller',
    'fantasy best series',
    'romance bestsellers',
  ];
  let pool = [];
  for (const q of queries) {
    try {
      const chunk = await fetchBooksMany(q, 80);
      pool = pool.concat(chunk);
      if (pool.length >= limit * 3) break;
    } catch (_) {}
  }
  // De-duplicate by id
  const seen = new Set();
  const unique = [];
  for (const it of pool) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    unique.push(it);
  }
  return unique.map(normalizeFromGoogleItem).slice(0, limit);
}

/**
 * Get curated Top Picks (Google Books only)
 *
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of top picks
 */
export async function getTopPicks(limit = 20) {
  // Try backend
  const items = await callApi('/top-picks', { limit });
  if (items && items.length) return items.map(normalizeBackendItem);
  // Fallback to a curated query
  const pool = await fetchBooksMany('editor picks fiction', Math.max(60, limit * 3));
  return pool.map(normalizeFromGoogleItem).slice(0, limit);
}

/**
 * Get books tailored to saved preferences (genres/authors)
 *
 * @param {{ genres?: string[]|string, authors?: string[]|string, limit?: number }} opts
 */
export async function getSavedPreferences(opts = {}) {
  const { genres = [], authors = [], limit = 20 } = opts || {};
  const params = {};
  if (genres && (Array.isArray(genres) ? genres.length : String(genres).trim())) {
    params.genres = Array.isArray(genres) ? genres.join(',') : String(genres);
  }
  if (authors && (Array.isArray(authors) ? authors.length : String(authors).trim())) {
    params.authors = Array.isArray(authors) ? authors.join(',') : String(authors);
  }
  if (limit) params.limit = limit;
  const items = await callApi('/saved-preferences', params);
  if (items && items.length) return items.map(normalizeBackendItem);
  // Fallback: combine queries from the user's preferences
  const queries = [];
  const g = Array.isArray(genres) ? genres : String(genres || '').split(',').map(s=>s.trim()).filter(Boolean);
  const a = Array.isArray(authors) ? authors : String(authors || '').split(',').map(s=>s.trim()).filter(Boolean);
  for (const gg of g) queries.push(`subject:${gg}`);
  for (const aa of a) queries.push(`inauthor:${aa}`);
  if (!queries.length) queries.push('bestsellers');
  let pool = [];
  for (const q of queries) {
    try { pool = pool.concat(await fetchBooksMany(q, 60)); } catch(_){}
  }
  // De-duplicate and trim
  const seen = new Set();
  const unique = [];
  for (const it of pool) { if (seen.has(it.id)) continue; seen.add(it.id); unique.push(it); }
  return unique.map(normalizeFromGoogleItem).slice(0, limit);
}

/**
 * Get author bio/details
 * @param {string} name - Author name
 */
export async function getAuthorBio(name){
  if (!name || !String(name).trim()) return null;
  // Try backend first
  try {
    const data = await apiService.request(`/recommendations/author-bio?name=${encodeURIComponent(String(name).trim())}`);
    if (data) return data;
  } catch (_) {}
  // Client-side fallback via Open Library
  try {
    const q = String(name).trim();
    const search = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}`);
    if (!search.ok) return null;
    const sJson = await search.json();
    const doc = (sJson?.docs || [])[0];
    if (!doc) return null;
    const key = doc.key; // e.g., "/authors/OL23919A"
    const olid = key?.split('/').pop();
    const detailsRes = await fetch(`https://openlibrary.org${key}.json`);
    const details = detailsRes.ok ? await detailsRes.json() : {};
    const worksRes = await fetch(`https://openlibrary.org${key}/works.json?limit=50`);
    const worksJson = worksRes.ok ? await worksRes.json() : { entries: [] };
    const notableWorks = (worksJson.entries || [])
      .map(w => w?.title).filter(Boolean).slice(0, 12);
    // Prefer explicit bio from details when available
    let bio = '';
    if (details && details.bio) {
      bio = typeof details.bio === 'string' ? details.bio : (details.bio?.value || '');
    }
    return {
      name: details?.name || doc.name || q,
      bookCount: doc.work_count ?? null,
      topWork: doc.top_work || null,
      topSubjects: Array.isArray(doc.top_subjects) ? doc.top_subjects.slice(0, 12) : [],
      notableWorks,
      bio: bio || '',
      birthDate: details?.birth_date || doc.birth_date || null,
      deathDate: details?.death_date || doc.death_date || null,
      aliases: Array.isArray(details?.alternate_names) ? details.alternate_names.slice(0, 10) : [],
      photo: olid ? `https://covers.openlibrary.org/a/olid/${olid}-L.jpg` : null,
      openLibraryUrl: key ? `https://openlibrary.org${key}` : null,
      wikipediaUrl: typeof details?.wikipedia === 'string' ? details.wikipedia : null,
    };
  } catch (_) {
    return null;
  }
}

/**
 * Get book info/details by title (and optional author)
 * @param {string} title
 * @param {string} [author]
 */
export async function getBookInfo(title, author){
  const t = String(title||'').trim();
  if (!t) return null;
  // Try backend first
  try{
    const qs = new URLSearchParams({ title: t });
    if (author && String(author).trim()) qs.set('author', String(author).trim());
    const data = await apiService.request(`/recommendations/book-info?${qs.toString()}`);
    if (data) return data;
  }catch(_){ /* fall through */ }
  // Client-side fallback via Open Library search
  try {
    const params = new URLSearchParams({ title: t });
    if (author && String(author).trim()) params.set('author', String(author).trim());
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}&limit=1`);
    if (!res.ok) return null;
    const json = await res.json();
    const doc = (json?.docs || [])[0];
    if (!doc) return null;
    const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
    let description = '';
    // Try work page for description if available
    if (doc.key) {
      try {
        const workRes = await fetch(`https://openlibrary.org${doc.key}.json`);
        if (workRes.ok) {
          const work = await workRes.json();
          description = typeof work.description === 'string' ? work.description : (work.description?.value || '');
        }
      } catch(_){}
    }
    return {
      title: doc.title || t,
      authors: Array.isArray(doc.author_name) ? doc.author_name : (doc.author_name ? [doc.author_name] : []),
      cover: cover || '/assets/default_cover.svg',
      description: description || (Array.isArray(doc.subject) ? doc.subject.slice(0,8).join(', ') : ''),
    };
  } catch(_) {
    return null;
  }
}

/**
 * Search books by keyword, author, or genre
 * 
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of matching books
 */
export async function searchBooks(query, limit = 60) {
  if (!query || query.trim() === '') {
    return getTrendingBooks(limit);
  }

  // Try backend
  const items = await callApi('/search', { q: query, limit });
  if (items && items.length) return items.map(normalizeBackendItem);
  // Fallback to Google Books
  let q = String(query).trim();
  const authorM = q.match(/^author\s*:\s*(.+)$/i);
  const genreM = q.match(/^genre\s*:\s*(.+)$/i);
  if (authorM) q = `inauthor:${authorM[1]}`;
  else if (genreM) q = `subject:${genreM[1]}`;
  const pool = await fetchBooksMany(q, Math.max(120, limit * 2));
  return pool.map(normalizeFromGoogleItem).slice(0, limit);
}

/**
 * Get books by specific author
 * 
 * @param {string} authorName - Author name
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of books by author
 */
export async function getBooksByAuthor(authorName, limit = 40) {
  return searchBooks(`author:${authorName}`, limit);
}

/**
 * Get books by genre
 * 
 * @param {string} genre - Genre name
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of books in genre
 */
export async function getBooksByGenre(genre, limit = 40) {
  return searchBooks(`genre:${genre}`, limit);
}
