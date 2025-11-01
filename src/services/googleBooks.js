const API_BASE = 'https://www.googleapis.com/books/v1/volumes?q=';

// Simple in-memory cache to speed up repeated queries during a dev session.
// Key is `${query}::${count}`. TTL is short to avoid stale results.
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

// Adult content filter disabled: include 18+ books as requested
function isAdultContent(_item) { return false; }

// Runtime blacklist: any title/author/id listed here will be excluded from
// Google Books results returned by the helper. Lowercase substrings are used.
const RUNTIME_BLOCKLIST = [
  'the ticket',
  // backend-aligned runtime exclusions
  'l. ron hubbard',
  'writers of the future',
  'karen wiesner',
  'midnight angel',
  'princess stakes',
  "duke's princess bride",
  'amalie howard',
  // calm-specific removals
  'calm the f',
  'calm the fuck down',
  "no f*cks given",
  'sandra brown',
  'rachel ryan',
  'walking dead'
];

export function isBlocked(item) {
  if (!item || !item.volumeInfo) return false;
  const info = item.volumeInfo;
  const title = (info.title || '').toString().toLowerCase();
  const authors = (info.authors || []).join(' ').toLowerCase();
  const id = (item.id || '').toString().toLowerCase();

  for (const sub of RUNTIME_BLOCKLIST) {
    if (!sub) continue;
    if (title.includes(sub)) return true;
    if (authors.includes(sub)) return true;
    if (id.includes(sub)) return true;
  }
  return false;
}

// fetchBooks now accepts an optional AbortSignal as third param so callers
// can cancel inflight requests (useful for debounced searches).
export default async function fetchBooks(query, startIndex = 0, max = 40, signal){
  if(!query) query = 'bestsellers';
  const url = API_BASE + encodeURIComponent(query) + `&startIndex=${startIndex}&maxResults=${max}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if(!res.ok) throw new Error('Network error');
  const json = await res.json();
  let items = (json.items || []).map(normalizeImageLinks);
  // Only apply runtime blocklist; allow adult/mature results
  items = items.filter(i => !isBlocked(i));
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
    requests.push(
      (async () => {
        try { return await fetchBooks(query, i * 40, 40, signal); }
        catch (_) { return []; }
      })()
    );
  }
  const settled = await Promise.allSettled(requests);
  const flat = settled
    .map(r => (r.status === 'fulfilled' ? r.value : []))
    .flat();
  // Normalize and filter adult content + runtime-blocklist
  const normalized = flat.map(normalizeImageLinks).filter(i => !isBlocked(i));
  cache.set(key, { t: now, v: normalized });
  return normalized;
}
