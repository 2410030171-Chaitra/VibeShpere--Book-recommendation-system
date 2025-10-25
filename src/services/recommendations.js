/**
 * Recommendations API Service
 * Handles all AI-based book recommendations from the backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Fetches book recommendations based on mood and genre
 * @param {string} mood - User's current mood (happy, sad, romantic, etc.)
 * @param {string} genre - Optional genre filter (fiction, mystery, etc.)
 * @param {number} limit - Maximum number of books to return
 * @returns {Promise<Array>} Array of recommended books
 */
export async function getRecommendations(mood, genre = '', limit = 40) {
  try {
    const params = new URLSearchParams();
    if (mood) params.append('mood', mood);
    if (genre) params.append('genre', genre);
    if (limit) params.append('limit', limit.toString());

    const url = `${API_BASE}/recommendations/discover?${params.toString()}`;
    console.log('📚 Fetching recommendations:', { mood, genre, limit });
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.books || [];
  } catch (error) {
    console.error('❌ Error fetching recommendations:', error);
    return [];
  }
}

/**
 * Fetches currently trending/popular books
 * @param {number} limit - Maximum number of books to return
 * @returns {Promise<Array>} Array of trending books
 */
export async function getTrendingBooks(limit = 40) {
  try {
    const url = `${API_BASE}/recommendations/trending?limit=${limit}`;
    console.log('🔥 Fetching trending books');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const books = await response.json();
    return Array.isArray(books) ? books : [];
  } catch (error) {
    console.error('❌ Error fetching trending books:', error);
    return [];
  }
}

/**
 * Searches for books by title, author, or keyword
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of matching books
 */
export async function searchBooks(query, limit = 60) {
  try {
    if (!query || !query.trim()) {
      return [];
    }

    const params = new URLSearchParams({
      q: query.trim(),
      limit: limit.toString()
    });

    const url = `${API_BASE}/recommendations/search?${params.toString()}`;
    console.log('🔍 Searching books:', query);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const books = await response.json();
    return Array.isArray(books) ? books : [];
  } catch (error) {
    console.error('❌ Error searching books:', error);
    return [];
  }
}

/**
 * Searches books by author name
 * @param {string} authorName - Name of the author
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of books by the author
 */
export async function getBooksByAuthor(authorName, limit = 20) {
  try {
    if (!authorName || !authorName.trim()) {
      return [];
    }

    const url = `${API_BASE}/recommendations/author/${encodeURIComponent(authorName)}?limit=${limit}`;
    console.log('👤 Fetching books by author:', authorName);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.books || [];
  } catch (error) {
    console.error('❌ Error fetching books by author:', error);
    return [];
  }
}

/**
 * Gets detailed information about a specific book
 * @param {string} bookId - Google Books volume ID
 * @returns {Promise<Object|null>} Book details or null if not found
 */
export async function getBookDetails(bookId) {
  try {
    const url = `${API_BASE}/recommendations/book/${bookId}`;
    console.log('📖 Fetching book details:', bookId);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.book || null;
  } catch (error) {
    console.error('❌ Error fetching book details:', error);
    return null;
  }
}

/**
 * Clears the API cache (useful for development)
 * @returns {Promise<boolean>} Success status
 */
export async function clearCache() {
  try {
    const url = `${API_BASE}/recommendations/cache/clear`;
    const response = await fetch(url, { method: 'POST' });
    return response.ok;
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return false;
  }
}

export default {
  getRecommendations,
  getTrendingBooks,
  searchBooks,
  getBooksByAuthor,
  getBookDetails,
  clearCache
};
