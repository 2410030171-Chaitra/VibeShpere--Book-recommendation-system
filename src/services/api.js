// API service for communicating with the backend
// During local tunnel testing we want the frontend to call the public backend tunnel.
// Public backend tunnel URL (created via localtunnel): https://curly-ties-fry.loca.lt
// Prefer an injected URL (e.g. from hosting or a dev tunnel).
// In Vite dev mode, default to the proxy at '/api'. In preview/production,
// default to same-origin '/api' unless overridden via window.__API_BASE_URL__.
// Priority of resolution (left to right):
// 1) window.__API_BASE_URL__ (runtime injection, e.g., from hosting)
// 2) Vite env var VITE_API_BASE_URL (compile-time for Static Site hosting like Render)
// 3) In dev, use Vite proxy '/api'
// 4) Fallback to local backend
const API_BASE_URL =
  (typeof window !== 'undefined' && window.__API_BASE_URL__)
  || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  // In dev, Vite proxy '/api'. In production builds (same-origin hosting), use '/api'.
  || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV ? '/api' : '/api');

class ApiService {
  constructor() {
    this.token = localStorage.getItem('calmreads_token');
  }

  // Helper method to make HTTP requests
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...options.headers,
      },
      cache: 'no-store',
      ...options,
    };

    if (this.token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Set auth token
  setToken(token) {
    this.token = token;
    localStorage.setItem('calmreads_token', token);
  }

  // Clear auth token
  clearToken() {
    this.token = null;
    localStorage.removeItem('calmreads_token');
  }

  // Auth methods
  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async login(credentials) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  // User methods
  async getUserProfile() {
    return await this.request('/user/profile');
  }

  async updateUserProfile(profileData) {
    return await this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Books methods
  async getBooks() {
    return await this.request('/books');
  }

  async getBook(id) {
    return await this.request(`/books/${id}`);
  }

  async searchBooks(query) {
    return await this.request(`/books/search/${encodeURIComponent(query)}`);
  }

  // Recommendations (backend-powered)
  async recoTrending(limit = 40, country) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (country) params.set('country', country);
    return await this.request(`/recommendations/trending?${params.toString()}`);
  }

  async recoSearch(q, limit = 60) {
    const url = `/recommendations/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`;
    return await this.request(url);
  }

  async recoDiscover({ mood = '', genre = '', limit = 40 } = {}) {
    const params = new URLSearchParams();
    if (mood) params.set('mood', mood);
    if (genre) params.set('genre', genre);
    if (limit) params.set('limit', String(limit));
    return await this.request(`/recommendations/discover?${params.toString()}`);
  }

  // Ratings methods
  async getUserRatings() {
    return await this.request('/ratings');
  }

  async rateBook(bookId, rating) {
    return await this.request('/ratings', {
      method: 'POST',
      body: JSON.stringify({ bookId, rating }),
    });
  }

  async getAllRatings() {
    return await this.request('/ratings/all');
  }

  // Library methods
  async getLibrary() {
    return await this.request('/library');
  }

  async addToLibrary(bookId) {
    return await this.request('/library/add', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    });
  }

  async updateProgress(bookId, progress) {
    return await this.request('/library/progress', {
      method: 'PUT',
      body: JSON.stringify({ bookId, progress }),
    });
  }

  async removeFromLibrary(bookId) {
    return await this.request(`/library/${bookId}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck() {
    return await this.request('/health');
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;