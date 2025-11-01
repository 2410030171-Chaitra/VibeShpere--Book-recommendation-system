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

// Runtime blocklist: exclude specific titles/authors/series at request
// Matching uses lowercase substring on title, authors and id.
const RUNTIME_BLOCKLIST = [
  // existing patterns and quality guardrails
  'the ticket',
  "a stranger's touch",
  'into the badlands',
  'tori carrington',
  'caron todd',
  'yearbook',
  'workbook',
  'study guide',
  'teacher',
  'teachers edition',
  'english language education',
  'test prep',
  'collection (books',
  // user-requested removals
  'l. ron hubbard',
  'writers of the future',
  'karen wiesner',
  'midnight angel',
  "princess stakes",
  "duke's princess bride",
  'amalie howard',
  // calm-specific removals from screenshots
  'calm the f',
  'calm the fuck down',
  "no f*cks given",
  'sandra brown',
  'rachel ryan',
  'walking dead'
];

function isRuntimeBlockedByText(title = '', authorsArr = [], id = ''){
  const titleLower = String(title||'').toLowerCase();
  const authorsLower = (Array.isArray(authorsArr) ? authorsArr : [authorsArr]).join(' ').toLowerCase();
  const idLower = String(id||'').toLowerCase();
  return RUNTIME_BLOCKLIST.some(b => b && (titleLower.includes(b) || authorsLower.includes(b) || idLower.includes(b)));
}

// Helper: fetch with timeout using AbortController to avoid hanging requests
const DEFAULT_FETCH_TIMEOUT_MS = 8000; // 8s
async function fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

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
  if(!cover) return null; // keep cover requirement for UI consistency

  // Runtime block
  if (isRuntimeBlockedByText(info.title, info.authors || [], item.id)) return null;
  return {
    id: item.id,
    title: info.title || 'Untitled',
    authors: info.authors || [],
    description: info.description || info.subtitle || '',
    cover,
    infoLink: info.infoLink || null,
    publishedDate: info.publishedDate || null,
    averageRating: info.averageRating || 0,
    categories: info.categories || [],
    language: info.language || null,
    saleCountry: (item && item.saleInfo && item.saleInfo.country) ? String(item.saleInfo.country) : null
  };
}

// Variant of cleanItem that does NOT require a cover. Useful for search endpoints
// where the frontend can render a placeholder when covers are missing.
function cleanItemAllowNoCover(item){
  const info = item.volumeInfo || {};
  const cover = pickCover(info);
  // Runtime block
  if (isRuntimeBlockedByText(info.title, info.authors || [], item.id)) return null;
  return {
    id: item.id,
    title: info.title || 'Untitled',
    authors: info.authors || [],
    description: info.description || info.subtitle || '',
    cover: cover || null,
    infoLink: info.infoLink || null,
    publishedDate: info.publishedDate || null,
    averageRating: info.averageRating || 0,
    categories: info.categories || [],
    language: info.language || null,
    saleCountry: (item && item.saleInfo && item.saleInfo.country) ? String(item.saleInfo.country) : null
  };
}

async function fetchPage(q, startIndex=0, max=40){
  const url = API_BASE + encodeURIComponent(q) + `&startIndex=${startIndex}&maxResults=${max}`;
  console.log(`[fetchPage] fetching ${url}`);
  const res = await fetchWithTimeout(url);
  if(!res.ok) {
    console.error(`[fetchPage] upstream not ok ${res.status} ${res.statusText} for ${url}`);
    throw new Error('Upstream error');
  }
  const json = await res.json();
  return (json.items || []);
}

// Variant that restricts language for Google Books
async function fetchPageWithLang(q, startIndex=0, max=40, langRestrict, countryIso2){
  const lr = langRestrict ? `&langRestrict=${encodeURIComponent(langRestrict)}` : '';
  const cr = countryIso2 ? `&country=${encodeURIComponent(countryIso2)}` : '';
  const url = API_BASE + encodeURIComponent(q) + `&startIndex=${startIndex}&maxResults=${max}` + lr + cr;
  console.log(`[fetchPageWithLang] fetching ${url}`);
  const res = await fetchWithTimeout(url);
  if(!res.ok) {
    console.error(`[fetchPageWithLang] upstream not ok ${res.status} ${res.statusText} for ${url}`);
    throw new Error('Upstream error');
  }
  const json = await res.json();
  return (json.items || []);
}

async function fetchMany(q, total=120){
  const pages = Math.ceil(total/40);
  const reqs = [];
  for(let i=0;i<pages;i++){
    reqs.push((async()=>{ try{ return await fetchPage(q, i*40, 40);} catch(_){ return []; } })());
  }
  const results = await Promise.allSettled(reqs);
  return results.map(r=>r.status==='fulfilled'? r.value: []).flat();
}

async function fetchManyWithLang(q, total=120, lang, countryIso2){
  const pages = Math.ceil(total/40);
  const reqs = [];
  for(let i=0;i<pages;i++){
    reqs.push((async()=>{ try{ return await fetchPageWithLang(q, i*40, 40, lang, countryIso2);} catch(_){ return []; } })());
  }
  const results = await Promise.allSettled(reqs);
  return results.map(r=>r.status==='fulfilled'? r.value: []).flat();
}

// Lightweight Open Library search for broader coverage (no API key)
async function fetchOpenLibrarySearch(q, limit = 100){
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}`;
    console.log(`[fetchOpenLibrarySearch] ${url}`);
    const res = await fetchWithTimeout(url);
    if(!res.ok) {
      console.error('[fetchOpenLibrarySearch] openlibrary responded with', res.status);
      return [];
    }
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
    }).filter(b => !!b.cover && !isRuntimeBlockedByText(b.title, b.authors, b.id));
  } catch (e) {
    console.error('[fetchOpenLibrarySearch] error', e && e.message);
    return [];
  }
}

// Mood -> rich keyword mapping (used to build the query and filter results)
// We expose a small set of top-level moods (positive, emotional, energetic,
// calm, tech, feelgood). Each maps to several keywords used to bias the
// Google Books/Open Library query so results match the mood descriptions.
const MOOD_KEYWORDS = {
  // 🌞 Positive: feel-good, uplifting, motivational, light humor, poetry
  positive: ['feel-good', 'heartwarming', 'uplifting', 'humor', 'inspirational', 'motivational', 'subject:humor', 'subject:poetry'],

  // 🌧️ Emotional: grief, loss, healing, memoirs, introspective fiction
  emotional: ['grief', 'loss', 'healing', 'poignant', 'bittersweet', 'introspective', 'memoir', 'subject:memoir'],

  // ⚡ Energetic: adventure, travel, fantasy quests, mysteries, thrillers
  energetic: ['adventure', 'travel', 'survival', 'epic quest', 'fantasy adventure', 'mystery', 'thriller', 'suspense', 'subject:adventure', 'subject:thriller'],

  // 🌙 Calm: cozy, gentle, slice-of-life, nature writing, thoughtful essays
  calm: [
    'cozy fantasy', 'cozy mystery', 'gentle', 'wholesome', 'comfort read', 'quiet novel',
    'magical realism', 'dreamy', 'slice of life', 'short stories',
    'pastoral', 'nature writing', 'cottagecore',
    'poetry', 'haiku', 'meditative essays', 'zen', 'mindfulness',
    'philosophy', 'spirituality',
    'subject:poetry', 'subject:philosophy', 'subject:nature'
  ],

  // 💡 Tech: science, technology, AI, data, creative non-fiction and sci-fi
  tech: ['science', 'technology', 'AI', 'artificial intelligence', 'data science', 'non-fiction', 'science fiction', 'speculative', 'subject:science', 'subject:technology', 'subject:science fiction'],

  // 💖 Feel-Good: resilience, kindness, community, diverse voices, uplifting
  feelgood: ['resilience', 'kindness', 'hopeful', 'community', 'diverse voices', 'uplifting', 'subject:inspirational']
};

function moodQuery(mood){
  const ks = MOOD_KEYWORDS[String(mood||'').toLowerCase()];
  if(!ks || !ks.length) return '';
  return ks.join(' OR ');
}

// Canonicalize common genre aliases sent by the frontend
function normalizeGenreAlias(g){
  const s = String(g||'').toLowerCase().trim();
  const map = {
    'scifi': 'science fiction',
    'sci-fi': 'science fiction',
    'nonfiction': 'non-fiction',
    'bio': 'biography',
    'ya': 'young adult'
  };
  return map[s] || s;
}

// GET /api/recommendations/trending?limit=40
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit||'40',10), 200);
    const country = String(req.query.country||'').trim();

    // Map country to one or more preferred languages for Google Books
    function countryToLangs(c){
      const k = String(c||'').toLowerCase();
      const map = {
        // English-dominant
        'united states': ['en'], 'usa': ['en'], 'us': ['en'],
        'united kingdom': ['en'], 'uk': ['en'], 'great britain': ['en'],
        'australia': ['en'], 'ireland': ['en'], 'new zealand': ['en'], 'singapore': ['en'],
        // India: English + Hindi
        'india': ['en','hi'], 'in': ['en','hi'],
        // Canada: English + French
        'canada': ['en','fr'], 'ca': ['en','fr'],
        // Europe major languages
        'germany': ['de'], 'de': ['de'],
        'france': ['fr'], 'fr': ['fr'],
        'spain': ['es'], 'es': ['es'], 'mexico': ['es'], 'mx': ['es'], 'argentina': ['es'], 'ar': ['es'], 'colombia': ['es'], 'co': ['es'], 'chile': ['es'], 'cl': ['es'],
        'italy': ['it'], 'it': ['it'],
        'portugal': ['pt'], 'pt': ['pt'], 'brazil': ['pt'], 'br': ['pt'],
        'netherlands': ['nl'], 'nl': ['nl'], 'belgium': ['nl','fr'], 'be': ['nl','fr'],
        'switzerland': ['de','fr','it'], 'ch': ['de','fr','it'],
        'poland': ['pl'], 'pl': ['pl'],
        'sweden': ['sv'], 'se': ['sv'], 'norway': ['no'], 'no': ['no'], 'denmark': ['da'], 'dk': ['da'], 'finland': ['fi'], 'fi': ['fi'],
        // Asia
        'japan': ['ja'], 'jp': ['ja'], 'south korea': ['ko'], 'kr': ['ko'],
        'china': ['zh'], 'cn': ['zh'], 'hong kong': ['zh','en'], 'hk': ['zh','en'],
        'taiwan': ['zh'], 'tw': ['zh'],
        // Middle East and others (Arabic + English)
        'saudi arabia': ['ar','en'], 'sa': ['ar','en'], 'uae': ['ar','en'], 'united arab emirates': ['ar','en'],
        'egypt': ['ar','en'], 'eg': ['ar','en'],
        // Africa
        'south africa': ['en'], 'za': ['en'],
        // Default
      };
      return map[k] || (k && k.length === 2 ? ['en'] : ['en']);
    }

    function countryToISO2(c){
      const m = {
        'india':'IN','in':'IN','united states':'US','usa':'US','us':'US','united kingdom':'GB','uk':'GB','great britain':'GB','germany':'DE','de':'DE','france':'FR','fr':'FR','spain':'ES','es':'ES','mexico':'MX','mx':'MX','argentina':'AR','colombia':'CO','italy':'IT','it':'IT','japan':'JP','jp':'JP','china':'CN','cn':'CN','brazil':'BR','br':'BR','portugal':'PT','pt':'PT','russia':'RU','ru':'RU','saudi arabia':'SA','sa':'SA','uae':'AE','united arab emirates':'AE','egypt':'EG','eg':'EG','canada':'CA','australia':'AU','ireland':'IE','new zealand':'NZ','south africa':'ZA'
      };
      const k = String(c||'').toLowerCase();
      if (m[k]) return m[k];
      // pass-through for raw ISO2 codes
      if (k.length === 2) return k.toUpperCase();
      return '';
    }

    const langs = countryToLangs(country);
    const iso2 = countryToISO2(country);
    const key = `trending:${limit}:${(langs||[]).join(',')}:${iso2||''}`;
    const c = getCached(key); if(c) return res.json(c);
  // Base queries
  const baseQ = 'bestsellers 2024 OR bestsellers 2025 OR award winning novel OR popular fiction OR trending mystery OR trending thriller OR trending fantasy OR subject:fiction';
  // Country-curated boosters to bias results towards regional charts/retailers
  const curatedByCountry = (cc)=>{
    const q = [];
    const ccUpper = String(cc||'').toUpperCase();
    if (['US','CA','GB','AU','NZ','IE'].includes(ccUpper)){
      q.push('New York Times best sellers', 'Amazon best sellers books', 'Goodreads Choice', 'Waterstones bestsellers');
    } else if (ccUpper==='IN'){
      q.push(
        'Hindustan Times bestsellers',
        'Amazon India best sellers books',
        'Flipkart bestsellers books',
        'Crossword bestsellers',
        'Blinkit books popular',
        'Indian fiction bestseller',
        'The Hindu books'
      );
    } else if (ccUpper==='DE'){
      q.push('Spiegel Bestseller', 'Thalia Bestseller');
    } else if (ccUpper==='FR'){
      q.push('FNAC best-sellers livres', 'Top ventes livres France');
    } else if (ccUpper==='ES'){
      q.push('Libros más vendidos España', 'Casa del Libro más vendidos');
    } else if (ccUpper==='BR'){
      q.push('Livros mais vendidos Brasil', 'Submarino livros mais vendidos', 'Saraiva mais vendidos');
    } else if (ccUpper==='IT'){
      q.push('Libri più venduti Italia', 'Feltrinelli bestseller');
    } else if (ccUpper==='JP'){
      q.push('本 ベストセラー', '紀伊國屋 書店 ランキング');
    }
    return q;
  };

    // Fetch Google candidates
    let googlePool = [];
    // For each preferred language, gather base and booster pools
    const boosters = curatedByCountry(iso2);
    for (const lang of (langs && langs.length ? langs : [null])){
      try{
        const basePool = lang ? await fetchManyWithLang(baseQ, Math.max(limit*2, 80), lang, iso2) : await fetchMany(baseQ, Math.max(limit*2, 80));
        googlePool = googlePool.concat(basePool);
      }catch(_){/* ignore */}
      for (const booster of boosters){
        try{
          const more = lang ? await fetchManyWithLang(booster, Math.max(limit*2, 80), lang, iso2) : await fetchMany(booster, Math.max(limit*2, 80));
          googlePool = googlePool.concat(more);
        }catch(_){/* ignore */}
      }
    }

    // If lang-restricted pool is thin, broaden with no-lang fallback
    if ((googlePool||[]).length < Math.max(limit, 60)){
      try{
        const more = await fetchMany(baseQ, Math.max(limit*2, 80));
        googlePool = googlePool.concat(more);
      }catch(_){/* ignore */}
    }

    const googleCleaned = (googlePool||[]).map(cleanItem).filter(Boolean);

    // Fetch trending books from Open Library (no API key needed)
    async function fetchOpenLibrary(limit) {
      const url = `https://openlibrary.org/subjects/bestsellers.json?limit=${limit}`;
      try {
        console.log(`[trending.fetchOpenLibrary] ${url}`);
        const res = await fetchWithTimeout(url);
        if (!res.ok) {
          console.error('[trending.fetchOpenLibrary] upstream error', res.status);
          return [];
        }
        const json = await res.json();
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
          .filter(b => !!b.cover && !isRuntimeBlockedByText(b.title, b.authors, b.id)); // include all topics, including 18+
      } catch (e) {
        return [];
      }
    }

  const openLibBooks = await fetchOpenLibrary(limit);

    // Merge and deduplicate by title+author
  const allBooks = [...googleCleaned, ...openLibBooks].filter(it => !isRuntimeBlockedByText(it.title, it.authors, it.id));
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
    // Score by sale country, rating, and recency
    const nowYear = new Date().getFullYear();
    function scoreItem(it){
      let s = 0;
      if (iso2 && it.saleCountry && String(it.saleCountry).toUpperCase() === iso2) s += 6;
      s += (it.averageRating || 0) * 1.5;
      if (it.publishedDate){
        const y = parseInt(String(it.publishedDate).slice(0,4),10);
        if (!Number.isNaN(y)){
          const age = Math.max(0, nowYear - y);
          s += Math.max(0, 3 - age/5);
        }
      }
      return s;
    }
    const ranked = unique
      .map(it=>({...it, _s: scoreItem(it)}))
      .sort((a,b)=>b._s-a._s)
      .slice(0, limit)
      .map(({_s, ...rest})=>rest);
    setCached(key, ranked);
    res.json(ranked);
  } catch (e) {
    console.error('trending error', e);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// GET /api/recommendations/author-bio?name=Ruskin%20Bond
router.get('/author-bio', async (req, res) => {
  try {
    const name = String(req.query.name||'').trim();
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const key = `authorbio:${name.toLowerCase()}`;
    const c = getCached(key); if (c) return res.json(c);

    // 1) Find author via Open Library authors search
    const searchUrl = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}`;
    const sres = await fetchWithTimeout(searchUrl);
    if (!sres.ok) return res.json({ name, bio: null });
    const sjson = await sres.json();
    const docs = Array.isArray(sjson?.docs) ? sjson.docs : [];
    const best = docs.find(d => String(d.name||'').toLowerCase() === name.toLowerCase()) || docs[0] || null;
    // If we didn't find an exact match, try a common variant (e.g., Murthy -> Murty)
    let authorDoc = best;
    if ((!authorDoc || !authorDoc.key) && /thy$/i.test(name)){
      const alt = name.replace(/thy$/i, 'ty');
      try{
        const altRes = await fetchWithTimeout(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(alt)}`);
        if (altRes.ok){
          const altJson = await altRes.json();
          const adocs = Array.isArray(altJson?.docs) ? altJson.docs : [];
          authorDoc = adocs.find(d => String(d.name||'').toLowerCase() === alt.toLowerCase()) || adocs[0] || authorDoc;
        }
      }catch(_){/* ignore */}
    }
    if (!authorDoc || !authorDoc.key) return res.json({ name, bio: null });

    // 2) Fetch author details
    const keyPart = authorDoc.key.replace(/^\/(authors|a)\//,'');
    const authorUrl = `https://openlibrary.org/authors/${keyPart}.json`;
    const ares = await fetchWithTimeout(authorUrl);
    if (!ares.ok) return res.json({ name: authorDoc.name || name, bio: null, photo: null });
    const ajson = await ares.json();
    let bio = null;
    if (typeof ajson.bio === 'string') bio = ajson.bio;
    else if (ajson.bio && typeof ajson.bio.value === 'string') bio = ajson.bio.value;
    let photo = `https://covers.openlibrary.org/a/olid/${keyPart}-L.jpg?default=false`;

    // Determine number of works/books authored and fetch a short list of notable works.
    // Prefer Open Library author's work_count when available; otherwise, try works endpoint's size.
    let bookCount = null;
    let notableWorks = [];
    try {
      if (typeof ajson.work_count === 'number' && ajson.work_count >= 0) {
        bookCount = ajson.work_count;
      } else {
        const wres = await fetchWithTimeout(`https://openlibrary.org/authors/${keyPart}/works.json?limit=1`);
        if (wres.ok) {
          const wjson = await wres.json();
          if (typeof wjson.size === 'number' && wjson.size >= 0) {
            bookCount = wjson.size;
          } else if (Array.isArray(wjson.entries)) {
            // Some responses may omit size; fallback to entries length (partial)
            bookCount = wjson.entries.length;
          }
        }
      }

      // Fetch a short list of works to highlight (notable works). Try to request up to 10 works.
      try {
        const topRes = await fetchWithTimeout(`https://openlibrary.org/authors/${keyPart}/works.json?limit=10`);
        if (topRes.ok) {
          const topJson = await topRes.json();
          const entries = Array.isArray(topJson.entries) ? topJson.entries : [];
          notableWorks = entries.map(e => (e && (e.title || e.key)) ? String(e.title || '').trim() : null).filter(Boolean).slice(0, 10);
        }
      } catch (_){ /* ignore notable works fetch errors */ }

    } catch(_){ /* ignore book count failures */ }

  // Prefer explicit wikipedia link on the author record when present
  let wikiTitleFromOL = null;
    try {
      const w = ajson.wikipedia;
      if (typeof w === 'string' && /wikipedia\.org\/wiki\//i.test(w)) {
        wikiTitleFromOL = decodeURIComponent((w.split('/wiki/')[1]||'').replace(/_/g,' '));
      }
      const links = Array.isArray(ajson.links) ? ajson.links : [];
      const wikiL = links.find(l => typeof l?.url === 'string' && /wikipedia\.org\/wiki\//i.test(l.url));
      if (!wikiTitleFromOL && wikiL) {
        wikiTitleFromOL = decodeURIComponent((wikiL.url.split('/wiki/')[1]||'').replace(/_/g,' '));
      }
    } catch(_){}

  // 3) If no bio from Open Library, try Wikipedia REST summary (en)
    if (!bio) {
      // helper: remove diacritics and punctuation
      const strip = (s)=> String(s||'').normalize('NFD').replace(/\p{Diacritic}+/gu,'').replace(/[.,'"()]/g,'').replace(/\s+/g,' ').trim();
      // helper: reorder "Last, First" -> "First Last"
      const reorder = (s)=>{ const m = String(s||'').match(/^([^,]+),\s*(.+)$/); return m ? (m[2]+' '+m[1]) : s; };
      const baseNames = [authorDoc.name, name, wikiTitleFromOL].filter(Boolean);
      const variants = new Set();
      for (const n of baseNames){
        const v1 = String(n).trim();
        variants.add(v1);
        variants.add(reorder(v1));
        variants.add(strip(v1));
        // Murthy -> Murty style variant
        variants.add(v1.replace(/thy$/i,'ty'));
      }

      // Try multiple languages for Wikipedia
      const langs = ['en','hi','fr','de','es','pt','it','ja','ru','ar','zh'];
      let found = false;

      // If Open Library linked a wiki page, prefer that exact title first (across langs)
      const prefer = wikiTitleFromOL ? [wikiTitleFromOL] : [];

      async function fetchWikiSummary(lang, title){
        try{
          const wp = await fetchWithTimeout(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
          if (wp.ok){
            const wj = await wp.json();
            if (wj && (wj.extract || wj.description)){
              bio = wj.extract || wj.description || null;
              if (wj.thumbnail && wj.thumbnail.source) photo = wj.thumbnail.source;
              return true;
            }
          }
        }catch(_){/* ignore */}
        return false;
      }

      async function wikiSearchAndFetch(lang, q){
        try{
          const sr = await fetchWithTimeout(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json`);
          if (sr.ok){
            const js = await sr.json();
            const title = js?.query?.search?.[0]?.title;
            if (title){
              return await fetchWikiSummary(lang, title);
            }
          }
        }catch(_){/* ignore */}
        return false;
      }

      // Attempt exact titles first
      for (const lang of langs){ if (found) break; for (const t of prefer){ if (t && await fetchWikiSummary(lang, t)){ found = true; break; } } }
      // Then attempt all variants across languages
      if (!found){ for (const lang of langs){ if (found) break; for (const t of variants){ if (await fetchWikiSummary(lang, t)){ found = true; break; } } } }
      // Finally, use search API to find best page
      if (!found){ for (const lang of langs){ if (found) break; for (const t of variants){ if (await wikiSearchAndFetch(lang, t)){ found = true; break; } } } }
    }

    // Additional metadata for richer UI
    const birthDate = ajson.birth_date || authorDoc.birth_date || null;
    const deathDate = ajson.death_date || authorDoc.death_date || null;
    const topWork = ajson.top_work || authorDoc.top_work || null;
    const topSubjects = Array.isArray(authorDoc.top_subjects) ? authorDoc.top_subjects.slice(0, 12) : [];
    const aliases = Array.isArray(ajson.alternate_names) ? ajson.alternate_names.slice(0, 8) : (Array.isArray(authorDoc.alternate_names) ? authorDoc.alternate_names.slice(0,8) : []);
    const openLibraryUrl = `https://openlibrary.org/authors/${keyPart}`;
    const wikipediaUrl = wikiTitleFromOL ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitleFromOL.replace(/\s+/g,'_'))}` : null;

    const out = { 
      name: authorDoc.name || name, 
      bio, 
      photo, 
      openLibraryKey: keyPart, 
      bookCount, 
      notableWorks,
      birthDate,
      deathDate,
      topWork,
      topSubjects,
      aliases,
      openLibraryUrl,
      wikipediaUrl
    };
    setCached(key, out);
    res.json(out);
  } catch (e) {
    console.error('author-bio error', e);
    res.status(500).json({ error: 'Failed to fetch author bio' });
  }
});

// GET /api/recommendations/book-info?title=The%20God%20of%20Small%20Things&author=Arundhati%20Roy
router.get('/book-info', async (req, res) => {
  try {
    const title = String(req.query.title||'').trim();
    const author = String(req.query.author||'').trim();
    if (!title) return res.status(400).json({ error: 'Missing title' });
    const key = `bookinfo:${title.toLowerCase()}:${author.toLowerCase()}`;
    const cached = getCached(key); if (cached) return res.json(cached);

    function normalizeTitle(s){
      return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
    }

    // 1) Try Google Books for a rich item first (enrich if description missing)
    let gbItem = null;
    try{
      const q = `intitle:"${title}"` + (author ? `+inauthor:"${author}"` : '');
      const items = await fetchMany(q, 40);
      // items here are raw Google items; cleanItem converts them
      const cleaned = (items||[]).map(cleanItem).filter(Boolean);
      const nt = normalizeTitle(title);
      gbItem = cleaned.find(i => normalizeTitle(i.title) === nt) || cleaned[0] || null;
      if (gbItem && !gbItem.description && gbItem.id){
        try{
          const vr = await fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(gbItem.id)}`);
          if (vr.ok){
            const vj = await vr.json();
            const info = vj && vj.volumeInfo;
            if (info && (info.description || info.subtitle)){
              gbItem.description = info.description || info.subtitle || gbItem.description;
              if (!gbItem.cover) {
                const img = info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);
                if (img) gbItem.cover = String(img).replace(/^http:/,'https:');
              }
            }
          }
        }catch(_){/* ignore */}
      }
    }catch(_){/* ignore */}

    // 2) If Google missing description, ask Open Library for details
    let olDetail = null;
    try{
      const qs = new URLSearchParams();
      qs.set('title', title);
      if (author) qs.set('author', author);
      qs.set('limit', '5');
      const sr = await fetchWithTimeout(`https://openlibrary.org/search.json?${qs.toString()}`);
      if (sr.ok){
        const js = await sr.json();
        const docs = js?.docs || [];
        const nt = normalizeTitle(title);
        const best = docs.find(d => normalizeTitle(d.title || d.title_suggest) === nt) || docs[0];
        if (best && best.key){
          const workKey = best.key.startsWith('/works/') ? best.key : null;
          if (workKey){
            const wr = await fetchWithTimeout(`https://openlibrary.org${workKey}.json`);
            if (wr.ok){
              const wj = await wr.json();
              let desc = null;
              if (typeof wj.description === 'string') desc = wj.description;
              else if (wj.description && typeof wj.description.value === 'string') desc = wj.description.value;
              const cover = (wj.covers && wj.covers[0]) ? `https://covers.openlibrary.org/b/id/${wj.covers[0]}-L.jpg` : null;
              olDetail = { description: desc, cover, infoLink: `https://openlibrary.org${workKey}` };
            }
          }
          // Fallback to an edition-level description if the work lacks one
          if (!olDetail || !olDetail.description) {
            const eds = Array.isArray(best.edition_key) ? best.edition_key.slice(0,3) : [];
            for (const ek of eds){
              try{
                const er = await fetchWithTimeout(`https://openlibrary.org/books/${encodeURIComponent(ek)}.json`);
                if (er.ok){
                  const ej = await er.json();
                  let d = null;
                  if (typeof ej.description === 'string') d = ej.description;
                  else if (ej.description && typeof ej.description.value === 'string') d = ej.description.value;
                  const c = ej.covers && ej.covers[0] ? `https://covers.openlibrary.org/b/id/${ej.covers[0]}-L.jpg` : null;
                  if (d || c){
                    olDetail = olDetail || {};
                    if (d && !olDetail.description) olDetail.description = d;
                    if (c && !olDetail.cover) olDetail.cover = c;
                  }
                }
              }catch(_){/* ignore */}
            }
          }
        }
      }
    }catch(_){/* ignore */}

    const out = {
      title: gbItem?.title || title,
      authors: gbItem?.authors || (author ? [author] : []),
      description: gbItem?.description || olDetail?.description || null,
      cover: gbItem?.cover || olDetail?.cover || null,
      infoLink: gbItem?.infoLink || olDetail?.infoLink || null,
      publishedDate: gbItem?.publishedDate || null,
      averageRating: gbItem?.averageRating || 0,
    };
    setCached(key, out);
    res.json(out);
  } catch (e) {
    console.error('book-info error', e);
    res.status(500).json({ error: 'Failed to fetch book info' });
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
    // Allow items without covers for search; frontend will show a placeholder
    let cleaned = pool.map(cleanItemAllowNoCover).filter(Boolean);
    // If too few results (e.g., very strict intitle queries), try a softer fallback
    if (cleaned.length < Math.min(10, limit/2)){
      try{
        const soft = await fetchMany(String(qq).replace(/intitle\s*:\s*"?([^"\s]+)"?/i, 'intitle:$1'), Math.max(limit*2, 120));
        cleaned = cleaned.concat(soft.map(cleanItemAllowNoCover).filter(Boolean));
      }catch(_){/* ignore */}
    }
    cleaned = cleaned.slice(0, limit);
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
    const { mood = '', genre = '', limit = '40', seed = '' } = req.query;
    const lim = Math.min(parseInt(limit,10)||40, 200);
  const moodPart = moodQuery(String(mood).toLowerCase());
    const normGenre = normalizeGenreAlias(genre);
    const genrePart = normGenre ? `subject:${normGenre}` : '';
    const parts = [moodPart, genrePart].filter(Boolean);
    // Add trending qualifiers to improve quality
    const q = parts.length ? `${parts.join(' ')} bestseller OR popular` : 'bestsellers';
  const key = `discover_ai:${mood}:${genre}:${lim}:${seed||''}`;
    const c = getCached(key); if(c) return res.json(c);

    // Fetch candidates from Google Books and Open Library in parallel
    console.log('[discover] query=', q, 'limit=', lim);
    const googlePromise = fetchMany(q, Math.max(lim*3, 120));
    const openLibPromise = fetchOpenLibrarySearch(`${mood} ${genre}`.trim(), Math.max(lim*2, 80));
    let googlePool = [];
    let openLibBooks = [];
    try {
      [googlePool, openLibBooks] = await Promise.all([googlePromise, openLibPromise]);
    } catch (err) {
      console.error('[discover] upstream fetch error', err && err.message);
      // continue with whatever completed or empty arrays
      googlePool = googlePool || [];
      openLibBooks = openLibBooks || [];
    }

    const candidates = [];
    // Clean Google items
    for (const it of (googlePool || [])) {
      const citem = cleanItem(it);
      if (citem) candidates.push(citem);
    }
    // Add Open Library items (already cover-validated); include all topics, including 18+
    for (const ob of (openLibBooks || [])) {
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

    // Strict relevance filter: only keep items related to selected mood/genre when provided
  const moodTerms = (MOOD_KEYWORDS[String(mood||'').toLowerCase()] || []).map(s=>String(s).toLowerCase());
  const genreTerm = (normGenre || '').toLowerCase();

    function matchesCriteria(it) {
      const text = ((it.title||'') + ' ' + (it.description||'') + ' ' + (it.categories||[]).join(' ') + ' ' + (it.authors||[]).join(' ')).toLowerCase();
      // If a mood is selected, require at least one mood term match
      if (moodTerms.length) {
        const ok = moodTerms.some(t => t && text.includes(t.replace('subject:','')));
        if (!ok) return false;
      }
      // If a genre is selected, require the genre to appear in categories or title
      if (genreTerm) {
        const catStr = (it.categories||[]).join(' ').toLowerCase();
        const titleStr = (it.title||'').toLowerCase();
        if (!catStr.includes(genreTerm) && !titleStr.includes(genreTerm)) return false;
      }
      return true;
    }

  const strictlyRelevant = unique.filter(matchesCriteria);
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

    // If strict set is too small (e.g., upstream variability), fall back to broader pool
    let base = strictlyRelevant.length >= Math.min(10, lim/2)
      ? strictlyRelevant
      : unique;

    // If still too small, broaden with curated fallback queries based on mood
  if (base.length < Math.min(10, lim/2)){
      const fallbackQueries = [];
      const m = String(mood||'').toLowerCase();
      if (m === 'calm') {
        fallbackQueries.push(
          'cozy fiction OR cozy fantasy OR cozy mystery bestseller OR popular',
          'nature writing OR mindfulness OR poetry OR meditative essays bestseller OR popular'
        );
      } else if (m === 'positive' || m === 'feelgood') {
        fallbackQueries.push(
          'feel-good uplifting heartwarming fiction bestseller OR popular'
        );
      }
      if (!fallbackQueries.length) fallbackQueries.push('bestsellers fiction');
      for (const fq of fallbackQueries){
        try{
          const extra = await fetchMany(fq, Math.max(lim*2, 80));
          const cleaned = extra.map(cleanItem).filter(Boolean);
          base = base.concat(cleaned);
          if (base.length >= lim) break;
        }catch(_){/* ignore */}
      }
      // If still small, try Open Library enrichment with friendlier keywords
      if (base.length < Math.min(10, lim/2)){
        const olTerms = m === 'calm'
          ? ['cozy', 'nature writing', 'mindfulness', 'poetry']
          : ['feel-good', 'heartwarming', 'inspirational', 'poetry'];
        for (const term of olTerms){
          try{
            const more = await fetchOpenLibrarySearch(term, Math.max(lim*3, 120));
            base = base.concat(more);
            if (base.length >= lim) break;
          }catch(_){/* ignore */}
        }
      }
    }
    const scoredAll = base
      .map(it => ({...it, _score: scoreItem(it)}))
      .sort((a,b)=>b._score - a._score);

    // Optional deterministic shuffle to vary results without sacrificing quality
    let out = scoredAll;
    if (seed) {
      const s = String(seed);
      // simple xorshift32 based on seed string
      let x = 0x9E3779B9;
      for (let i = 0; i < s.length; i++) x ^= (s.charCodeAt(i) + (x<<6) + (x>>2));
      function rnd(){
        // xorshift32
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x>>>0) / 0xFFFFFFFF);
      }
      out = [...scoredAll];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
    }
    const result = out.slice(0, lim);
    setCached(key, result);
    res.json(result);
  } catch (e) {
    console.error('discover error', e);
    res.status(500).json({ error: 'Failed to discover' });
  }
});
// --- ROUTES: Top Picks, Saved Preferences, Recently Viewed ---

// GET /api/recommendations/top-picks
router.get('/top-picks', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit||'20',10), 40);
    const key = `top-picks:${limit}`;
    const c = getCached(key);
    if (c) return res.json(c);

    // Fiction-forward, award/trending heavy
    const q = 'bestsellers 2024 OR bestsellers 2025 OR award winning novel OR popular fiction OR trending romance OR trending mystery OR trending thriller OR trending fantasy';
    const books = await fetchMany(q, Math.max(limit*8, 160));
    let cleaned = books.map(cleanItem).filter(Boolean);

    if (cleaned.length < limit) {
      const ol = await fetchOpenLibrarySearch('bestsellers fiction', limit*3);
      cleaned = [...cleaned, ...ol];
    }

    // Dedup and cap
    const seen = new Set();
    const out = [];
    for (const it of cleaned) {
      const k = (it.title + '|' + (it.authors||[]).join(',')).toLowerCase();
      if (seen.has(k)) continue; seen.add(k); out.push(it);
      if (out.length >= limit) break;
    }
    setCached(key, out);
    res.json(out);
  } catch (e) {
    console.error('top-picks error', e);
    res.status(500).json({ error: 'Failed to fetch top picks' });
  }
});

// GET /api/recommendations/saved-preferences?genres=fiction,history&authors=rowling
router.get('/saved-preferences', async (req, res) => {
  try {
    const { genres = '', authors = '' } = req.query;
    const limit = Math.min(parseInt(req.query.limit||'20',10), 40);
    const key = `saved-prefs:${genres}:${authors}:${limit}`;
    const c = getCached(key);
    if (c) return res.json(c);

    const parts = [];
    if (genres) parts.push(genres.split(',').map(g => `subject:${g.trim()}`).join(' OR '));
    if (authors) parts.push(authors.split(',').map(a => `inauthor:${a.trim()}`).join(' OR '));
    parts.push('bestseller OR award winning OR popular');
    const q = parts.join(' ') || 'bestsellers';

    const books = await fetchMany(q, Math.max(limit*6, 120));
    let cleaned = books.map(cleanItem).filter(Boolean);

    // If still short, expand with author-only and genre-only enrichers
    const authorsList = String(authors||'').split(',').map(s=>s.trim()).filter(Boolean);
    const genresList = String(genres||'').split(',').map(s=>s.trim()).filter(Boolean);
    if (cleaned.length < limit && authorsList.length){
      for (const a of authorsList){
        try{
          const more = await fetchMany(`inauthor:${a} bestseller OR popular`, 80);
          cleaned.push(...more.map(cleanItem).filter(Boolean));
        }catch(_){/* ignore */}
      }
    }
    if (cleaned.length < limit && genresList.length){
      for (const g of genresList){
        try{
          const more = await fetchMany(`subject:${g} bestseller OR popular`, 80);
          cleaned.push(...more.map(cleanItem).filter(Boolean));
        }catch(_){/* ignore */}
      }
    }

    // Open Library fill as a last resort
    if (cleaned.length < limit) {
      const fallbackQueries = [];
      if (authorsList.length) fallbackQueries.push(...authorsList);
      if (genresList.length) fallbackQueries.push(...genresList);
      if (!fallbackQueries.length) fallbackQueries.push('bestsellers');
      for (const fq of fallbackQueries){
        try{
          const ol = await fetchOpenLibrarySearch(fq, limit*2);
          cleaned.push(...ol);
          if (cleaned.length >= limit) break;
        }catch(_){/* ignore */}
      }
    }

    const seen = new Set(); const out = [];
    for (const it of cleaned) {
      const k = (it.title + '|' + (it.authors||[]).join(',')).toLowerCase();
      if (seen.has(k)) continue; seen.add(k); out.push(it);
      if (out.length >= limit) break;
    }
    setCached(key, out);
    res.json(out);
  } catch (e) {
    console.error('saved-preferences error', e);
    res.status(500).json({ error: 'Failed to fetch saved preferences' });
  }
});

// GET /api/recommendations/recently-viewed?titles=Atomic%20Habits,1984
router.get('/recently-viewed', async (req, res) => {
  try {
    const { titles = '' } = req.query;
    if (!titles) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit||'15',10), 50);
    const key = `recently-viewed:${titles}:${limit}`;
    const c = getCached(key);
    if (c) return res.json(c);

    const q = titles.split(',').map(t => `intitle:${t.trim()}`).join(' OR ');
    const books = await fetchMany(q, Math.max(limit*4, 80));
    let cleaned = books.map(cleanItem).filter(Boolean);
    if (cleaned.length < limit) {
      // Try an Open Library top search on the first title as a soft fill
      const first = String(titles).split(',')[0] || 'bestsellers';
      const ol = await fetchOpenLibrarySearch(first, limit*2);
      cleaned = [...cleaned, ...ol];
    }
    const seen = new Set(); const out = [];
    for (const it of cleaned) {
      const k = (it.title + '|' + (it.authors||[]).join(',')).toLowerCase();
      if (seen.has(k)) continue; seen.add(k); out.push(it);
      if (out.length >= limit) break;
    }
    setCached(key, out);
    res.json(out);
  } catch (e) {
    console.error('recently-viewed error', e);
    res.status(500).json({ error: 'Failed to fetch recently viewed' });
  }
});
router.get('/discover', async (req, res) => {
  // your existing discover code
});


// --- NEW ROUTES: Top Picks, Saved Preferences, Recently Viewed ---

// GET /api/recommendations/top-picks
router.get('/top-picks', async (req, res) => {
  try {
    const key = 'top-picks';
    const c = getCached(key);
    if (c) return res.json(c);

    const q = 'bestsellers OR award-winning OR top rated OR popular fiction';
    const books = await fetchMany(q, 100);
    const cleaned = books.map(cleanItem).filter(Boolean).slice(0, 20);

    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('top-picks error', e);
    res.status(500).json({ error: 'Failed to fetch top picks' });
  }
});

// GET /api/recommendations/saved-preferences?genres=fiction,history&authors=rowling
router.get('/saved-preferences', async (req, res) => {
  try {
    const { genres = '', authors = '' } = req.query;
    const key = `saved-prefs:${genres}:${authors}`;
    const c = getCached(key);
    if (c) return res.json(c);

    let queryParts = [];
    if (genres) queryParts.push(genres.split(',').map(g => `subject:${g.trim()}`).join(' OR '));
    if (authors) queryParts.push(authors.split(',').map(a => `inauthor:${a.trim()}`).join(' OR '));
    const q = queryParts.join(' ') || 'bestsellers';

    const books = await fetchMany(q, 100);
    const cleaned = books.map(cleanItem).filter(Boolean).slice(0, 20);

    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('saved-preferences error', e);
    res.status(500).json({ error: 'Failed to fetch saved preferences' });
  }
});

// GET /api/recommendations/recently-viewed?titles=Atomic%20Habits,1984
router.get('/recently-viewed', async (req, res) => {
  try {
    const { titles = '' } = req.query;
    if (!titles) return res.json([]);
    const key = `recently-viewed:${titles}`;
    const c = getCached(key);
    if (c) return res.json(c);

    const q = titles.split(',').map(t => `intitle:${t.trim()}`).join(' OR ');
    const books = await fetchMany(q, 60);
    const cleaned = books.map(cleanItem).filter(Boolean).slice(0, 15);

    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('recently-viewed error', e);
    res.status(500).json({ error: 'Failed to fetch recently viewed' });
  }
});
// existing routes above...
router.get('/discover', async (req, res) => {
  // your existing discover code
});
router.get('/top-picks', async (req, res) => {
  try {
    const key = 'top-picks';
    const c = getCached(key);
    if (c) return res.json(c);

    const q = 'bestsellers OR award-winning OR top rated OR popular fiction';
    const books = await fetchMany(q, 100);
    const cleaned = books.map(cleanItem).filter(Boolean).slice(0, 20);

    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('top-picks error', e);
    res.status(500).json({ error: 'Failed to fetch top picks' });
  }
});
router.get('/saved-preferences', async (req, res) => {
  try {
    const { genres = '', authors = '' } = req.query;
    const key = `saved-prefs:${genres}:${authors}`;
    const c = getCached(key);
    if (c) return res.json(c);

    let queryParts = [];
    if (genres) queryParts.push(genres.split(',').map(g => `subject:${g.trim()}`).join(' OR '));
    if (authors) queryParts.push(authors.split(',').map(a => `inauthor:${a.trim()}`).join(' OR '));
    const q = queryParts.join(' ') || 'bestsellers';

    const books = await fetchMany(q, 100);
    const cleaned = books.map(cleanItem).filter(Boolean).slice(0, 20);

    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('saved-preferences error', e);
    res.status(500).json({ error: 'Failed to fetch saved preferences' });
  }
});

// GET /api/recommendations/recently-viewed?titles=Atomic%20Habits,1984
router.get('/recently-viewed', async (req, res) => {
  try {
    const { titles = '' } = req.query;
    if (!titles) return res.json([]);
    const key = `recently-viewed:${titles}`;
    const c = getCached(key);
    if (c) return res.json(c);

    const q = titles.split(',').map(t => `intitle:${t.trim()}`).join(' OR ');
    const books = await fetchMany(q, 60);
    const cleaned = books.map(cleanItem).filter(Boolean).slice(0, 15);

    setCached(key, cleaned);
    res.json(cleaned);
  } catch (e) {
    console.error('recently-viewed error', e);
    res.status(500).json({ error: 'Failed to fetch recently viewed' });
  }
});



module.exports = router;
