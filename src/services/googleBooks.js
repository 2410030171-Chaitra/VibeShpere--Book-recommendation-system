const API_BASE = 'https://www.googleapis.com/books/v1/volumes?q=';

// Simple in-memory cache to speed up repeated queries during a dev session.
// Key is `${query}::${count}`. TTL is short (30s) to avoid stale results.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeImageLinks(item){
  if(!item || !item.volumeInfo) return item;
  const info = item.volumeInfo;
  if (info.imageLinks) {
    const links = {};
    for (const k of Object.keys(info.imageLinks)) {
      try {
        links[k] = info.imageLinks[k].replace(/^http:/, 'https:');
      } catch (e) {
        links[k] = info.imageLinks[k];
      }
    }
    info.imageLinks = links;
  }
  return item;
}

// fetchBooks now accepts an optional AbortSignal as third param so callers
// can cancel inflight requests (useful for debounced searches).
export default async function fetchBooks(query, startIndex = 0, max = 40, signal){
  if(!query) query = 'bestsellers';
  const url = API_BASE + encodeURIComponent(query) + `&startIndex=${startIndex}&maxResults=${max}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if(!res.ok) throw new Error('Network error');
  const json = await res.json();
  const items = (json.items || []).map(normalizeImageLinks);
  return items;
}

// Fetch many results (over 40) by paging startIndex as Google Books caps maxResults at 40.
export async function fetchBooksMany(query, count = 200, signal){
  if(!query) query = 'bestsellers';
  const key = `${query}::${count}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && (now - cached.t) < CACHE_TTL_MS) {
    return cached.v.map(normalizeImageLinks);
  }

  const numPages = Math.ceil(count / 40);
  const requests = [];
  for (let i = 0; i < numPages; i++) {
    requests.push(fetchBooks(query, i * 40, 40, signal));
  }
  const results = await Promise.all(requests);
  const flat = results.flat();
  cache.set(key, { t: now, v: flat });
  return flat.map(normalizeImageLinks);
}
