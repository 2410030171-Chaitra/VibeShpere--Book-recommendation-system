/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef } from 'react';
import BookImage from './BookImage.jsx';
import fetchBooks, { fetchBooksMany } from '../services/googleBooks';
import apiService from '../services/api';
import { getAuthorBio, getBookInfo } from '../services/recommendations';
import '../index.css';

// Helpers to prefer Open Library covers when an ISBN is available (better coverage, fewer placeholders)
function getBestIsbn(info){
  const ids = info?.industryIdentifiers || [];
  const isbn13 = ids.find(x=>x.type==='ISBN_13')?.identifier;
  const isbn10 = ids.find(x=>x.type==='ISBN_10')?.identifier;
  return isbn13 || isbn10 || null;
}
function openLibCoverUrl(isbn){
  if(!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

// Note: We now use the shared BookImage for consistent fallbacks and to avoid
// Google "image not available" thumbnails. We keep the old ExploreCover code
// commented above for reference.

export default function GoogleBooksGallery({ userDataManager }) {
  // Temporary blocklist to remove problematic or unwanted books from Explore
  // You can extend these lists with more titles or exact volume IDs.
  const BLOCKED = {
    titles: new Set([
      'bestsellers, 1979-1983',
      'bestsellers',
      'bestsellers of the third reich',
    ]),
    ids: new Set([
      // Add volume IDs here to block by exact Google volume id
    ]),
  };
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Type a search and press Enter');
  const [favorites, setFavorites] = useState(userDataManager ? userDataManager.getData('favorites', []) : []);
  const [loading, setLoading] = useState(false);
  const [authorInfo, setAuthorInfo] = useState(null);
  const [bookInfo, setBookInfo] = useState(null);
  const authorImgWrapRef = useRef(null);
  const authorContentRef = useRef(null);
  const [authorImgHeight, setAuthorImgHeight] = useState(null);

  // Keep the author image height in sync with the content block height so the
  // photo shows only as much as the information area (no extra tall or short).
  useEffect(() => {
    if (!authorInfo) { setAuthorImgHeight(null); return; }
    const update = () => {
      const h = authorContentRef.current?.offsetHeight || 0;
      setAuthorImgHeight(h > 0 ? h : null);
    };
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined' && authorContentRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(authorContentRef.current);
    }
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [authorInfo]);

  // Helper: escape HTML to avoid XSS when injecting markup
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Highlight notable works by wrapping exact title matches in <strong>
  // Safety/quality rules:
  // - Escape the bio first to avoid XSS
  // - Only consider multi-word titles (>= 2 words) or long titles (>= 12 chars)
  // - Require a space or hyphen in the title (avoid single-word false positives like "Indian")
  // - Exclude generic single nouns like "Poems", "Stories", "Essays", etc.
  // - Use boundary-aware matching so we don't bold substrings inside larger words
  function highlightNotableWorks(bio, notableWorks) {
    if (!bio) return '';
    let out = escapeHtml(bio);
    if (!Array.isArray(notableWorks) || notableWorks.length === 0) return out;

    const GENERIC_RE = /^(poem|poems|story|stories|essay|essays|works|novel|novels|selected|collected|volume|vol\.?|book|books|guide|reader|readings?)$/i;

    // Filter and clean titles
    const candidates = [...new Set(
      notableWorks
        .map(t => String(t || '').replace(/[“”]/g, '"').trim())
        .filter(Boolean)
        .filter(t => {
          const s = t.replace(/["'()\[\]{}]/g, '').trim();
          const words = s.split(/\s+/).filter(w => w.length > 1);
          const hasSpaceOrHyphen = /[\s-]/.test(s);
          const longEnough = s.length >= 12;
          const multiWord = words.length >= 2;
          const generic = GENERIC_RE.test(s);
          return (multiWord || longEnough) && hasSpaceOrHyphen && !generic;
        })
    )];

    // Sort by length desc to avoid partial matches (longer titles first)
    candidates.sort((a, b) => b.length - a.length);

    for (const title of candidates) {
      const esc = escapeRegExp(title.trim());
      if (!esc) continue;
      // Boundary-aware regex: capture a safe prefix boundary and the title, ensure a safe suffix boundary
      const regex = new RegExp(`(^|[\n\r\t\s\(\[\"'‘’“”])(${esc})(?=[\n\r\t\s\)\]\.\,;:!\?\"'‘’“”]|$)`, 'gi');
      out = out.replace(regex, (m, pre, match) => `${pre}<strong>${match}</strong>`);
    }
    return out;
  }

  // Build a synthetic bio paragraph when real bio is missing/too short
  function buildSyntheticBio(info){
    if (!info) return '';
    const parts = [];
    const name = String(info.name||'').trim();
    const books = (typeof info.bookCount === 'number' && info.bookCount >= 0) ? info.bookCount : null;
    if (name && books !== null){
      parts.push(`${name} is an author of ${books} ${books === 1 ? 'book' : 'books'}.`);
    } else if (name){
      parts.push(`${name} is an author.`);
    }
    const notables = Array.isArray(info.notableWorks) ? [...new Set(info.notableWorks.filter(Boolean))].slice(0,3) : [];
    if (notables.length){
      parts.push(`Notable works include ${notables.join(', ')}.`);
    } else if (info.topWork){
      parts.push(`Known for ${info.topWork}.`);
    }
    if (Array.isArray(info.topSubjects) && info.topSubjects.length){
      const sub = info.topSubjects.slice(0,6).join(', ');
      parts.push(`Common subjects: ${sub}.`);
    }
    return parts.join(' ');
  }
  

  // Removed auto-load on mount - user must search first

  function mapAuthorQuery(raw){
    const s = String(raw || '').trim();
    const authorM = s.match(/^author\s*:\s*(.+)$/i);
    const byM = s.match(/^by\s+(.+)$/i);
    if (authorM) return `inauthor:${authorM[1]}`;
    if (byM) return `inauthor:${byM[1]}`;
    const genreM = s.match(/^genre\s*:\s*(.+)$/i);
    if (genreM) return `subject:${genreM[1]}`;
    return s;
  }

  function extractAuthorName(raw){
    const s = String(raw||'').trim();
    const authorM = s.match(/^author\s*:\s*(.+)$/i);
    const byM = s.match(/^by\s+(.+)$/i);
    const inAuthorM = s.match(/^inauthor\s*:\s*(.+)$/i);
    let name = (authorM?.[1]) || (byM?.[1]) || (inAuthorM?.[1]) || '';
    // Heuristic: looks like a person name only if 2-4 tokens without common title stopwords
    if (!name) {
      const hasOperator = /[:]/.test(s) || /subject\s*:/i.test(s) || /intitle\s*:/i.test(s);
      const words = s.split(/\s+/).filter(Boolean);
      const stop = new Set(['and','of','the','in','on','for','with','to','a','an','day','days','night','nights','story','stories','novel','poem','poems','guide','diary','diaries','chronicles','tales','book','books','volume','vol','saga','part','season']);
      const containsStop = words.some(w => stop.has(w.toLowerCase()));
      const isLikelyName = !hasOperator && !containsStop && words.length >= 2 && words.length <= 4 && words.every(w => /[A-Za-zÀ-ÿ\-'.]/.test(w));
      if (isLikelyName) name = s;
    }
    return String(name).trim();
  }

  function extractTitleCandidate(raw){
    const s = String(raw||'').trim();
    const titleM = s.match(/^title\s*:\s*(.+)$/i) || s.match(/^intitle\s*:\s*(.+)$/i);
    if (titleM) return titleM[1].trim();
    const hasOperator = /\b(inauthor|intitle|subject)\s*:/i.test(s);
    if (hasOperator) return '';
    const words = s.split(/\s+/).filter(Boolean);
    // If it doesn't look like a name (handled elsewhere) and has 2-10 words, assume it's a title phrase
    if (words.length >= 2 && words.length <= 10) return s;
    return '';
  }

  function normalizeTitle(t){
    return String(t||'').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function strictTitleMatch(bookTitle, queryTitle){
    const bt = normalizeTitle(bookTitle);
    const qt = normalizeTitle(queryTitle);
    if (!bt || !qt) return false;
    return bt === qt || bt.startsWith(qt) || qt.startsWith(bt);
  }

  async function load(q){
    setStatus('Searching...');
    setItems([]);
    setLoading(true);
    setAuthorInfo(null);
    setBookInfo(null);
    let pool = [];
    const target = 40;
    try {
      // Detect both possibilities; if both seem valid, prefer AUTHOR (e.g., "Sudha Murthy")
      const titleCand = extractTitleCandidate(q);
      const authorName = extractAuthorName(q);
      let mapped = mapAuthorQuery(q);
      const authorMode = Boolean(authorName && (!titleCand || titleCand === q));
      const titleMode = Boolean(titleCand) && !authorMode;
      if (authorMode) {
        mapped = `inauthor:\"${authorName}\"`;
        getAuthorBio(authorName).then((info)=>{ if (info) setAuthorInfo(info); }).catch(()=>{});
      } else if (titleMode) {
        mapped = `intitle:\"${titleCand}\"`;
        getBookInfo(titleCand).then((info)=>{ if (info) setBookInfo(info); }).catch(()=>{});
      }
      // Try backend first for caching and consistent cover filtering
      try {
        const fromApi = await apiService.recoSearch(mapped || 'bestsellers', 200);
        if (Array.isArray(fromApi) && fromApi.length) {
          // Convert backend format to Google-like items shape for minimal changes
            pool = fromApi.map((b) => ({
              id: b.id,
              volumeInfo: {
                title: b.title,
                authors: b.authors,
                description: b.description,
                imageLinks: b.cover ? { thumbnail: b.cover, smallThumbnail: b.cover } : undefined,
                industryIdentifiers: b.industryIdentifiers,
                infoLink: b.infoLink
              }
            }));
        }
      } catch(e){
        // ignore and fallback
      }
      if (!pool.length) {
        pool = await fetchBooksMany(mapped || q, 200);
      }

      // Helpers used below for filtering
      const hasCover = (info) => {
        const isbn = getBestIsbn(info);
        const openLib = openLibCoverUrl(isbn);
        const g = info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail;
        return !!(openLib || g);
      };

      // Allow all content including 18+ (no adult filtering)
      const isAppropriate = (_info) => true;

      // Check if book is relevant to the search query
      const isRelevant = (info, searchQuery) => {
        // For author searches, trust upstream; don't filter
        if (authorMode) return true;
        // Strict title scenario
        if (titleMode) {
          return strictTitleMatch(info.title || '', titleCand);
        }

        const title = (info.title || '').toLowerCase();
        const authorsStr = (info.authors || []).join(' ').toLowerCase();
        const description = (info.description || '').toLowerCase();
        const categories = (info.categories || []).join(' ').toLowerCase();

        // Author query handling: require author tokens to appear in authors string
        const inAuthor = /^inauthor\s*:/i.test(searchQuery);
        if (inAuthor) return true;

        // Generic keyword relevance fallback
        const cleanQuery = searchQuery
          .replace(/^(inauthor|inpublisher|intitle|subject):/gi, '')
          .replace(/["'()]/g, ' ')
          .toLowerCase()
          .trim();
        if (!cleanQuery) return true;
        const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 2);
        return queryWords.some(word =>
          title.includes(word) ||
          authorsStr.includes(word) ||
          description.includes(word) ||
          categories.includes(word)
        );
      };

      let filtered = [];
      const seen = new Set();
      for (const item of pool) {
        const info = item.volumeInfo || {};
        const title = (info.title || '').trim().toLowerCase();
        if (BLOCKED.ids.has(item.id) || BLOCKED.titles.has(title)) continue;
  // Allow items even without a cover; a placeholder will be shown.
  // No adult content filtering: include all
        if (!isRelevant(info, mapped)) continue; // Check relevance
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        filtered.push(item);
        if (filtered.length >= target) break;
      }

      // If strict title path yielded nothing, relax to a softer contains match
      if (filtered.length === 0 && titleCand) {
        for (const item of pool) {
          const info = item.volumeInfo || {};
          const normT = normalizeTitle(info.title || '');
          if (!normT) continue;
          if (normT.includes(normalizeTitle(titleCand))) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            filtered.push(item);
            if (filtered.length >= target) break;
          }
        }
      }

      // If we didn't get enough results, try an author-focused fallback
      if (filtered.length < target) {
        try {
          const authorPool = await fetchBooksMany(`inauthor:${q}`, 200);
          for (const item of authorPool) {
            const info = item.volumeInfo || {};
            const title = (info.title || '').trim().toLowerCase();
            if (BLOCKED.ids.has(item.id) || BLOCKED.titles.has(title)) continue;
            // Allow items without covers; we'll render a placeholder instead.
            // No adult content filtering in fallback
            if (!isRelevant(info, mapped)) continue; // Check relevance in fallback too
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            filtered.push(item);
            if (filtered.length >= target) break;
          }
        } catch (e) {
          // ignore author fallback failures
        }
      }

      // If Google returned very few items (common on some networks/regions),
      // fall back to Open Library search to augment results with proper covers.
      if (filtered.length < 12) {
        try {
          const params = new URLSearchParams();
          // Prefer author-focused search when we detected an author name
          const authorName = extractAuthorName(q);
          if (authorName) params.set('author', authorName);
          const titleCand = extractTitleCandidate(q);
          if (titleCand) params.set('title', titleCand);
          if (!authorName && !titleCand) params.set('q', q);
          params.set('limit', '40');
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, { signal: controller.signal });
          clearTimeout(t);
          if (res.ok) {
            const json = await res.json();
            const docs = Array.isArray(json?.docs) ? json.docs : [];
            const olItems = [];
            for (const d of docs) {
              const coverId = d?.cover_i;
              const olCover = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
              if (!olCover) continue; // require a real cover to avoid placeholders
              const title = d?.title || d?.title_suggest || 'Untitled';
              const authors = Array.isArray(d?.author_name) ? d.author_name : (d?.author_name ? [d.author_name] : []);
              const isbn = Array.isArray(d?.isbn) && d.isbn.length ? d.isbn[0] : undefined;
              olItems.push({
                id: `ol-${d.key || d.cover_i || Math.random().toString(36).slice(2)}`,
                volumeInfo: {
                  title,
                  authors,
                  description: d?.first_sentence || '',
                  imageLinks: { thumbnail: olCover, smallThumbnail: olCover },
                  industryIdentifiers: isbn ? [{ type: 'ISBN_13', identifier: isbn }] : undefined,
                  infoLink: d?.key ? `https://openlibrary.org${d.key}` : undefined
                }
              });
              if (filtered.length + olItems.length >= target) break;
            }
            if (olItems.length) {
              filtered = [...filtered, ...olItems].slice(0, target);
            }
          }
        } catch(_) {
          // ignore OL fallback failure
        }
      }

      setItems(filtered);
      setStatus(filtered.length ? `Showing ${filtered.length} result${filtered.length>1?'s':''}` : 'No results');
    }catch(e){
      console.error(e);
      setStatus('Could not fetch books');
    }
    setLoading(false);
  }

  // Save to Recently Viewed
  function recordHistoryFromExplore(item){
    try {
      const info = item.volumeInfo || {};
      const title = info.title || 'Untitled';
      const authors = (info.authors || []).join(', ') || 'Unknown';
      const thumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;
      const entry = { id: item.id, title, authors, cover: thumb, infoLink: info.infoLink };
      if (userDataManager) {
        const cur = userDataManager.getData('history', []) || [];
        const next = [entry, ...cur.filter(h => h.id !== item.id)].slice(0, 24);
        userDataManager.saveData('history', next);
      } else {
        const raw = localStorage.getItem('vibesphere_guest_history');
        const cur = raw ? JSON.parse(raw) : [];
        const next = [entry, ...cur.filter(h => h.id !== item.id)].slice(0, 24);
        localStorage.setItem('vibesphere_guest_history', JSON.stringify(next));
      }
      window.dispatchEvent(new CustomEvent('historyUpdated'));
    } catch(_){}
  }

  function toggleFavLocal(item){
    if(!userDataManager) return;
    const book = { id: item.id, title: item.volumeInfo?.title, authors: (item.volumeInfo?.authors||[]).join(', '), cover: item.volumeInfo?.imageLinks?.thumbnail };
    const fav = userDataManager.getData('favorites', []);
    const exists = fav.find((b)=>b.id===book.id);
    let updated;
    if(exists) updated = fav.filter((b)=>b.id!==book.id);
    else updated = [book, ...fav];
    userDataManager.saveData('favorites', updated);
    setFavorites(updated);
  }

  function onSubmit(e){
    e.preventDefault();
    if(!query) return;
    load(query);
  }

  return (
    <div className="explore-page max-w-6xl mx-auto px-4 py-8">
      <div className="modern-card p-6 mb-6">
        <form onSubmit={onSubmit} className="flex gap-3 items-center">
          <input placeholder="Search books by title, author, or keyword" value={query} onChange={e=>setQuery(e.target.value)} className="input-modern" />
        
          <button className="btn-primary" type="submit">Search</button>
        </form>
        {authorInfo && (
          <div className="mt-4 flex gap-4 items-start p-4 rounded-lg border bg-white/70">
            {authorInfo.photo && (
              <div
                className="flex-shrink-0 w-24 sm:w-28 md:w-40"
                ref={authorImgWrapRef}
                style={{ height: authorImgHeight ? `${authorImgHeight}px` : undefined }}
              >
                <img
                  src={authorInfo.photo}
                  alt={authorInfo.name}
                  className="w-full h-full object-cover rounded-lg border border-slate-200/70 shadow-sm"
                  onError={(e)=>{e.currentTarget.style.display='none';}}
                />
              </div>
            )}
            <div ref={authorContentRef}>
              <div className="font-semibold text-slate-800">About {authorInfo.name}</div>
              {(() => {
                let bio = String(authorInfo.bio || '').trim();
                if (!bio) {
                  const synthetic = buildSyntheticBio({
                    name: authorInfo.name,
                    bookCount: authorInfo.bookCount,
                    notableWorks: authorInfo.notableWorks,
                    topWork: authorInfo.topWork,
                    topSubjects: authorInfo.topSubjects
                  });
                  bio = synthetic;
                } else if (bio.length < 80) {
                  // Augment very short bios with a synthetic continuation to reduce empty feel
                  const tail = buildSyntheticBio({
                    name: authorInfo.name,
                    bookCount: authorInfo.bookCount,
                    notableWorks: authorInfo.notableWorks,
                    topWork: authorInfo.topWork,
                    topSubjects: authorInfo.topSubjects
                  });
                  if (tail) bio = bio.replace(/[\.]?\s*$/, '. ') + tail;
                }
                const highlighted = bio ? highlightNotableWorks(bio, authorInfo.notableWorks) : '';
                const didHighlight = bio && highlighted !== escapeHtml(bio);
                const notableList = Array.isArray(authorInfo.notableWorks) ? [...new Set(authorInfo.notableWorks.filter(Boolean))] : [];
                const topNotables = notableList.slice(0, 6);
                const metaItems = [];
                if (typeof authorInfo.bookCount === 'number' && authorInfo.bookCount >= 0) {
                  metaItems.push({ label: 'Books', value: `${authorInfo.bookCount}` });
                }
                if (authorInfo.birthDate) metaItems.push({ label: 'Born', value: authorInfo.birthDate });
                if (authorInfo.deathDate) metaItems.push({ label: 'Died', value: authorInfo.deathDate });
                if (authorInfo.topWork) metaItems.push({ label: 'Top work', value: authorInfo.topWork });
                if (Array.isArray(authorInfo.topSubjects) && authorInfo.topSubjects.length) metaItems.push({ label: 'Subjects', value: authorInfo.topSubjects.slice(0,6).join(', ') });

                return (
                  <>
                    {metaItems.length > 0 && (
                      <div className="text-xs text-slate-600 mt-1 mb-2 flex flex-wrap gap-x-4 gap-y-1">
                        {metaItems.map((m, idx) => (
                          <div key={`meta-${idx}`} className="whitespace-nowrap">
                            <span className="text-slate-500">{m.label}:</span> <span className="font-medium">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {bio ? (
                      <p
                        className="text-sm text-slate-600 whitespace-pre-line md:line-clamp-6"
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">No biography available.</p>
                    )}

                    {topNotables.length > 0 && (
                      <p className="text-sm text-slate-600 mt-2">
                        <span className="text-slate-500 mr-1">Notable works:</span>
                        {topNotables.map((t, i) => (
                          <React.Fragment key={`notable-${i}`}>
                            <strong>{t}</strong>{i < topNotables.length - 1 ? ', ' : ''}
                          </React.Fragment>
                        ))}
                      </p>
                    )}

                    {(Array.isArray(authorInfo.aliases) && authorInfo.aliases.length > 0) && (
                      <div className="text-xs text-slate-600 mt-2 flex flex-wrap gap-2">
                        <span className="text-slate-500">Also known as:</span>
                        {authorInfo.aliases.slice(0, 6).map((s, i) => (
                          <span key={`aka-${i}`} className="px-2 py-0.5 rounded-full bg-slate-100 border text-slate-700">{s}</span>
                        ))}
                      </div>
                    )}

                    {(Array.isArray(authorInfo.topSubjects) && authorInfo.topSubjects.length > 0) && (
                      <div className="text-xs text-slate-600 mt-2 flex flex-wrap gap-2">
                        {authorInfo.topSubjects.slice(0, 10).map((s, i) => (
                          <span key={`subj-${i}`} className="px-2 py-0.5 rounded-full bg-slate-100 border text-slate-700">{s}</span>
                        ))}
                      </div>
                    )}

                    {false && (
                      <div className="mt-3">
                        {/* Explore CTA intentionally removed per user request */}
                      </div>
                    )}

                    {(authorInfo.openLibraryUrl || authorInfo.wikipediaUrl) && (
                      <div className="text-xs text-slate-500 mt-2 space-x-3">
                        {authorInfo.openLibraryUrl && (
                          <a className="underline hover:text-slate-700" href={authorInfo.openLibraryUrl} target="_blank" rel="noopener noreferrer">Open Library</a>
                        )}
                        {authorInfo.wikipediaUrl && (
                          <a className="underline hover:text-slate-700" href={authorInfo.wikipediaUrl} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        {bookInfo && (
          <div className="mt-4 flex gap-4 items-start p-4 rounded-lg border bg-white/70">
            {bookInfo.cover && (
              <img src={bookInfo.cover} alt={bookInfo.title} className="w-20 h-28 object-cover rounded" onError={(e)=>{e.currentTarget.style.display='none';}} />
            )}
            <div>
              <div className="font-semibold text-slate-800">About "{bookInfo.title}"{bookInfo.authors?.length ? ` by ${bookInfo.authors.join(', ')}` : ''}</div>
              {bookInfo.description ? (
                <p className="text-sm text-slate-600 whitespace-pre-line line-clamp-6">{bookInfo.description}</p>
              ) : (
                <p className="text-sm text-slate-500">No description available.</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-2">
        {loading && Array.from({length:8}).map((_,i)=> (
          <div key={`skel-${i}`} className="book-tile">
            <article className="book-card skeleton-card">
              <div className="book-cover-wrap">
                <div className="skeleton shimmer" />
              </div>
              <div className="book-info">
                <div className="skeleton skeleton-line" style={{width:'60%'}} />
                <div className="skeleton skeleton-line" style={{width:'40%'}} />
                <div className="skeleton skeleton-line" style={{width:'90%'}} />
                <div className="card-footer" />
              </div>
            </article>
          </div>
        ))}
        </div>
      </div>

      <section className="grid-responsive">
        {items.map(item=>{
          const info = item.volumeInfo || {};
          const title = info.title || 'Untitled';
          const authors = (info.authors || []).join(', ');
          const desc = info.description || info.subtitle || '';
          let thumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;

          // Skip if on blocklist (by exact id or normalized title)
          const normTitle = (title || '').trim().toLowerCase();
          if (BLOCKED.ids.has(item.id) || BLOCKED.titles.has(normTitle)) {
            return null;
          }

          // Try to normalize Google Books thumbnail to request a larger zoom when possible
          function normalizeGoogleThumb(url) {
            if (!url) return null;
            let u = url.replace(/^http:/, 'https:');
            // If Google Books API thumbnail includes zoom param, try zoom=2 for higher res
            try {
              u = u.replace(/(zoom=)\d+/,'$12');
              // remove any trailing &edge=curl param that can cause odd shapes (keep it if needed)
              // ensure URL is well-formed
            } catch (e) {}
            return u;
          }

          const thumbHigh = normalizeGoogleThumb(thumb);
          const isbn = getBestIsbn(info);
          const openLib = openLibCoverUrl(isbn);

          // If neither Open Library nor Google provides a cover, skip rendering this tile.
          // We allow cards without cover; ExploreCover will render a placeholder.

          return (
            <div key={item.id} className="book-tile">
              <article className="book-card">
                <div className="book-cover-wrap">
                  <BookImage
                    primaryUrl={openLib || thumbHigh}
                    altIdentifiers={{ isbn }}
                    title={title}
                    author={authors}
                    className="book-cover book-cover--strict"
                  />
                </div>
                <div className="book-info">
                  <h3 className="book-title">{title}</h3>
                  <p className="book-authors">{authors}</p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-3">{desc || 'No description available.'}</p>
                  <div className="card-footer">
                    <a className="view-link" href={info.infoLink} target="_blank" rel="noopener noreferrer" onClick={() => recordHistoryFromExplore(item)}>View</a>
                    {userDataManager && (
                      <button className="px-2 py-1 ml-2 text-pink-600" onClick={()=>toggleFavLocal(item)}>
                        {favorites.find((b)=>b.id===item.id) ? '💖' : '🤍'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </section>

      <div className="status mt-6">{status}</div>
    </div>
  );
}
