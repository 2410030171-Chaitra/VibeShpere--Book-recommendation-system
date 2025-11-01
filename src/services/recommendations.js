/**
 * Recommendations Service
 * 
 * Connects to backend API for AI-powered book recommendations
 * Fetches books from Google Books API + Open Library via backend
 * No API keys required
 */

import apiService from './api';

// When using Vite dev server, the proxy handles "/api"; when using
// vite preview/production (no proxy), apiService points to the backend
// (http://localhost:3001/api by default or window.__API_BASE_URL__).
// To work seamlessly in both, we build endpoints without the leading
// "/api" and always go through apiService.
const API_BASE = '/recommendations';

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
    console.error('Failed to call API:', error);
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
  const params = {};
  if (mood) params.mood = mood;
  if (genre && genre !== 'all') params.genre = genre;
  if (limit) params.limit = limit;
  if (seed !== undefined && seed !== null && seed !== '') params.seed = String(seed);
  
  const items = await callApi('/discover', params);
  return items.map(normalizeBackendItem);
}

/**
 * Get currently trending books
 * 
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of trending books
 */
export async function getTrendingBooks(opts = {}) {
  const { limit = 40, country } = opts || {};
  const params = { limit };
  if (country) params.country = country;
  const items = await callApi('/trending', params);
  return items.map(normalizeBackendItem);
}

/**
 * Get curated Top Picks (Google Books only)
 *
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of top picks
 */
export async function getTopPicks(limit = 20) {
  // Backend route currently slices to 20; limit is for future compatibility
  const items = await callApi('/top-picks', { limit });
  return items.map(normalizeBackendItem);
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
  return items.map(normalizeBackendItem);
}

/**
 * Get author bio/details
 * @param {string} name - Author name
 */
export async function getAuthorBio(name){
  if (!name || !String(name).trim()) return null;
  try {
    const data = await apiService.request(`/recommendations/author-bio?name=${encodeURIComponent(String(name).trim())}`);
    return data || null;
  } catch (e) {
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
  try{
    const qs = new URLSearchParams({ title: t });
    if (author && String(author).trim()) qs.set('author', String(author).trim());
    const data = await apiService.request(`/recommendations/book-info?${qs.toString()}`);
    return data || null;
  }catch(_){
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
  
  const items = await callApi('/search', { q: query, limit });
  return items.map(normalizeBackendItem);
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
