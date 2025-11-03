export * from './recommendations2';

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

/**
 * Get currently trending books
 * @param {number|{limit?:number,country?:string}} opts
 */
/**
 * Get author bio/details
  const result = { name: q, bookCount: null, notableWorks: [], topSubjects: [], bio: '', photo: null, birthDate: null, deathDate: null, aliases: [], openLibraryUrl: null, wikipediaUrl: null, topWork: null };

  // Helper normalization and similarity
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
  const levenshtein = (a, b) => {
    a = norm(a); b = norm(b);
    const m = a.length, n = b.length;
    if (m === 0) return n; if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  };

 

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
    const docs = (sJson?.docs || []);
    if (!docs.length) {
      return { name: q, bookCount: null, notableWorks: [], topSubjects: [] };
    }

    // Choose best match by similarity to query, prefer higher work_count
    const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
    const levenshtein = (a, b) => {
      a = norm(a); b = norm(b);
      const m = a.length, n = b.length;
      if (m === 0) return n; if (n === 0) return m;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
        }
      }
      return dp[m][n];
    };
    const qn = norm(q);
    let best = null; let bestScore = -Infinity;
    for (const d of docs) {
      const dn = norm(d.name || '');
      const dist = levenshtein(dn, qn);
      let score = 100 - Math.min(dist, 100);
      if ((d.work_count ?? 0) > 0) score += Math.min(d.work_count, 50) * 0.1; // small bonus
      if (dn === qn) score += 25; // exact normalized match bonus
      // Common variant: Murthy vs Murty
      if (dn.replace(/h/g,'') === qn.replace(/h/g,'')) score += 10;
      if (score > bestScore) { bestScore = score; best = d; }
    }

    const doc = best || docs[0];
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

    // If Open Library has a photo id list but no direct image, derive image URL
    let photoUrl = null;
    try {
      if (Array.isArray(details?.photos) && details.photos.length > 0) {
        const pid = details.photos.find((x)=>Number.isFinite(x));
        if (Number.isFinite(pid)) photoUrl = `https://covers.openlibrary.org/a/id/${pid}-L.jpg`;
      }
    } catch(_){}

    // Wikipedia enrichment: if bio is empty/short, or we still lack photo, try wiki summary
    try {
      const wTitle = typeof details?.wikipedia === 'string' ? details.wikipedia.replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//,'') : null;
      const page = wTitle || null;
      if (page) {
        const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
        if (wiki.ok) {
          const wj = await wiki.json();
          if ((!bio || bio.length < 120) && wj.extract) bio = wj.extract;
          if (!photoUrl && wj.thumbnail && wj.thumbnail.source) photoUrl = wj.thumbnail.source;
        }
      }
    } catch(_){}
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
      photo: photoUrl || (olid ? `https://covers.openlibrary.org/a/olid/${olid}-L.jpg` : null),
      openLibraryUrl: key ? `https://openlibrary.org${key}` : null,
      wikipediaUrl: typeof details?.wikipedia === 'string' ? details.wikipedia : null,
    };
  } catch (_) {
    // Return minimal object so UI can synthesize a small bio instead of hiding the section
    return { name: String(name).trim(), bookCount: null, notableWorks: [], topSubjects: [] };
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

    // If still no description, try Wikipedia summary (en)
    if (!description || description.length < 40) {
      try {
        const page = t; // best-effort page title
        const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
        if (wiki.ok) {
          const wj = await wiki.json();
          if (wj.extract) description = wj.extract;
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

