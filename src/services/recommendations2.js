/**
 * Recommendations Service (clean)
 *
 * Backend-first with graceful client fallbacks.
 */
import apiService from './api';
import fetchBooks, { fetchBooksMany } from './googleBooks';

const API_BASE = '/recommendations';

function buildQuery(params){
  const qs = new URLSearchParams();
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function callApi(path, params){
  try {
    const url = `${API_BASE}${path}${buildQuery(params)}`;
    const data = await apiService.request(url);
    return data || null;
  } catch(_) { return null; }
}

function normalizeBackendItem(x){
  if (!x) return null;
  const authors = Array.isArray(x.authors) ? x.authors : (x.author ? [x.author] : []);
  return {
    id: x.id || x.googleId || x.olId || `${x.title || 'untitled'}::${authors.join(',')}`,
    title: x.title || 'Untitled',
    authors,
    description: x.description || '',
    cover: x.cover || x.thumbnail || '/assets/default_cover.svg',
  };
}

function normalizeFromGoogleItem(item){
  const info = item?.volumeInfo || {};
  const authors = Array.isArray(info.authors) ? info.authors : (info.authors ? [info.authors] : []);
  const img = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
  return {
    id: item?.id || `${info.title || 'untitled'}::${authors.join(',')}`,
    title: info.title || 'Untitled',
    authors,
    description: info.description || '',
    cover: img || '/assets/default_cover.svg',
  };
}

export async function getTrendingBooks(opts = {}){
  let limit = 40; let country;
  if (typeof opts === 'number') limit = opts;
  else if (opts && typeof opts === 'object') { limit = opts.limit ?? 40; country = opts.country; }
  const items = await callApi('/trending', { limit, country });
  if (items && items.length) return items.map(normalizeBackendItem);
  const pool = await fetchBooksMany('bestsellers', Math.max(120, limit * 3));
  return pool.map(normalizeFromGoogleItem).slice(0, limit);
}

export async function getTopPicks(limit = 20){
  const items = await callApi('/top-picks', { limit });
  if (items && items.length) return items.map(normalizeBackendItem);
  const pool = await fetchBooksMany('editor picks fiction', Math.max(60, limit * 3));
  return pool.map(normalizeFromGoogleItem).slice(0, limit);
}

export async function getSavedPreferences(opts = {}){
  const { genres = [], authors = [], limit = 20 } = opts || {};
  const items = await callApi('/saved-preferences', { genres, authors, limit });
  if (items && items.length) return items.map(normalizeBackendItem);
  // fallback: mix authors + genres
  const queries = [];
  const g = Array.isArray(genres) ? genres : String(genres || '').split(',').map(s=>s.trim()).filter(Boolean);
  const a = Array.isArray(authors) ? authors : String(authors || '').split(',').map(s=>s.trim()).filter(Boolean);
  for (const gg of g) queries.push(`subject:${gg}`);
  for (const aa of a) queries.push(`inauthor:${aa}`);
  if (!queries.length) queries.push('bestsellers');
  let pool = [];
  for (const q of queries) { try { pool = pool.concat(await fetchBooksMany(q, 60)); } catch(_){} }
  const seen = new Set(); const unique = [];
  for (const it of pool) { if (seen.has(it.id)) continue; seen.add(it.id); unique.push(it); }
  return unique.map(normalizeFromGoogleItem).slice(0, limit);
}

export async function getAuthorBio(name){
  if (!name || !String(name).trim()) return null;
  const q = String(name).trim();
  try { const data = await callApi('/author-bio', { name: q }); if (data) return data; } catch(_){ }

  const result = { name: q, bookCount: null, notableWorks: [], topSubjects: [], bio: '', photo: null, birthDate: null, deathDate: null, aliases: [], openLibraryUrl: null, wikipediaUrl: null, topWork: null };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
  const levenshtein = (a, b) => { a = norm(a); b = norm(b); const m = a.length, n = b.length; if (!m) return n; if (!n) return m; const dp = Array.from({length:m+1},()=>Array(n+1).fill(0)); for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j; for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ const cost=a[i-1]===b[j-1]?0:1; dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);} } return dp[m][n]; };

  let doc=null, olid=null, details={};
  try {
    const search = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}`);
    if (search.ok){
      const sJson = await search.json();
      const docs = sJson?.docs || [];
      if (docs.length){
        const qn = norm(q); let best=null, bestScore=-Infinity;
        for (const d of docs){ const dn = norm(d.name||''); const dist = levenshtein(dn, qn); let score = 100 - Math.min(dist,100); if ((d.work_count??0)>0) score += Math.min(d.work_count,50)*0.1; if (dn===qn) score+=25; if (dn.replace(/h/g,'')===qn.replace(/h/g,'')) score+=10; if (score>bestScore){ bestScore=score; best=d; } }
        doc = best || docs[0];
        result.name = doc.name || result.name;
        result.bookCount = doc.work_count ?? result.bookCount;
        result.topWork = doc.top_work || result.topWork;
        result.topSubjects = Array.isArray(doc.top_subjects) ? doc.top_subjects.slice(0, 12) : result.topSubjects;
        const key = doc.key; olid = key?.split('/').pop(); result.openLibraryUrl = key ? `https://openlibrary.org${key}` : result.openLibraryUrl;
        try { const detailsRes = await fetch(`https://openlibrary.org${key}.json`); if (detailsRes.ok) details = await detailsRes.json(); if (details?.name) result.name = details.name; if (details?.birth_date) result.birthDate = details.birth_date; if (details?.death_date) result.deathDate = details.death_date; if (Array.isArray(details?.alternate_names)) result.aliases = details.alternate_names.slice(0, 10); if (details?.bio) { result.bio = typeof details.bio==='string'?details.bio:(details.bio?.value||result.bio);} if (Array.isArray(details?.photos) && details.photos.length>0 && !result.photo){ const pid = details.photos.find((x)=>Number.isFinite(x)); if (Number.isFinite(pid)) result.photo = `https://covers.openlibrary.org/a/id/${pid}-L.jpg`; } } catch(_){ }
        try { const worksRes = await fetch(`https://openlibrary.org${key}/works.json?limit=50`); if (worksRes.ok){ const worksJson = await worksRes.json(); const works = (worksJson.entries||[]).map(w=>w?.title).filter(Boolean); if (works.length) result.notableWorks = works.slice(0, 12);} } catch(_){ }
      }
    }
  } catch(_){ }

  try {
    let pageTitle = null;
    if (typeof details?.wikipedia === 'string'){ pageTitle = details.wikipedia.replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//,''); result.wikipediaUrl = details.wikipedia; }
    if (!pageTitle){ const searchApi = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(result.name || q)}&format=json&origin=*`; const ws = await fetch(searchApi); if (ws.ok){ const wj = await ws.json(); const first = wj?.query?.search?.[0]; if (first && first.title) pageTitle = first.title; } }
    if (pageTitle){ const sum = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`); if (sum.ok){ const sj = await sum.json(); if ((!result.bio || result.bio.length < 120) && sj.extract) result.bio = sj.extract; if (!result.photo && sj.thumbnail?.source) result.photo = sj.thumbnail.source; if (!result.wikipediaUrl && sj.content_urls?.desktop?.page) result.wikipediaUrl = sj.content_urls.desktop.page; } }
  } catch(_){ }

  if (!result.photo && olid){ result.photo = `https://covers.openlibrary.org/a/olid/${olid}-L.jpg`; }
  if ((!result.notableWorks || result.notableWorks.length === 0) && result.name){ try { const p = new URLSearchParams({ author: result.name, limit: '20' }); const r = await fetch(`https://openlibrary.org/search.json?${p.toString()}`); if (r.ok){ const j = await r.json(); const titles = (j?.docs || []).map(d=>d?.title || d?.title_suggest).filter(Boolean); if (titles.length) result.notableWorks = [...new Set(titles)].slice(0, 12); } } catch(_){ } }

  return result;
}

export async function getBookInfo(title, author){
  const t = String(title||'').trim();
  if (!t) return null;
  try{ const qs = new URLSearchParams({ title: t }); if (author && String(author).trim()) qs.set('author', String(author).trim()); const data = await callApi('/book-info', Object.fromEntries(qs)); if (data) return data; }catch(_){ }
  try {
    const params = new URLSearchParams({ title: t }); if (author && String(author).trim()) params.set('author', String(author).trim());
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}&limit=1`);
    if (!res.ok) return null;
    const json = await res.json();
    const doc = (json?.docs || [])[0];
    if (!doc) return null;
    const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
    let description = '';
    if (doc.key) {
      try { const workRes = await fetch(`https://openlibrary.org${doc.key}.json`); if (workRes.ok){ const work = await workRes.json(); description = typeof work.description === 'string' ? work.description : (work.description?.value || ''); } } catch(_){ }
    }
    if (!description || description.length < 40) { try { const page = t; const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`); if (wiki.ok){ const wj = await wiki.json(); if (wj.extract) description = wj.extract; } } catch(_){ } }
    return { title: doc.title || t, authors: Array.isArray(doc.author_name) ? doc.author_name : (doc.author_name ? [doc.author_name] : []), cover: cover || '/assets/default_cover.svg', description: description || (Array.isArray(doc.subject) ? doc.subject.slice(0,8).join(', ') : '') };
  } catch(_){ return null; }
}

export async function searchBooks(query, limit = 60){
  if (!query || String(query).trim() === '') return getTrendingBooks(limit);
  const items = await callApi('/search', { q: query, limit });
  if (items && items.length) return items.map(normalizeBackendItem);
  let q = String(query).trim();
  const authorM = q.match(/^author\s*:\s*(.+)$/i); const genreM = q.match(/^genre\s*:\s*(.+)$/i);
  if (authorM) q = `inauthor:${authorM[1]}`; else if (genreM) q = `subject:${genreM[1]}`;
  const pool = await fetchBooksMany(q, Math.max(120, limit * 2));
  return pool.map(normalizeFromGoogleItem).slice(0, limit);
}

export async function getRecommendations(opts = {}){
  const { genres = [], authors = [], limit = 24 } = opts || {};
  const items = await callApi('/recommend', { genres, authors, limit });
  if (items && items.length) return items.map(normalizeBackendItem);
  // Lightweight fallback
  const g = Array.isArray(genres) ? genres : String(genres || '').split(',').map(s=>s.trim()).filter(Boolean);
  const a = Array.isArray(authors) ? authors : String(authors || '').split(',').map(s=>s.trim()).filter(Boolean);
  const queries = [];
  for (const gg of g) queries.push(`subject:${gg}`);
  for (const aa of a) queries.push(`inauthor:${aa}`);
  if (!queries.length) queries.push('bestsellers');
  let pool = [];
  for (const q of queries) { try { pool = pool.concat(await fetchBooksMany(q, 60)); } catch(_){ } }
  const seen = new Set(); const unique = [];
  for (const it of pool) { if (seen.has(it.id)) continue; seen.add(it.id); unique.push(it); }
  return unique.map(normalizeFromGoogleItem).slice(0, limit);
}

export async function getBooksByAuthor(authorName, limit = 40){ return searchBooks(`author:${authorName}`, limit); }
export async function getBooksByGenre(genre, limit = 40){ return searchBooks(`genre:${genre}`, limit); }
