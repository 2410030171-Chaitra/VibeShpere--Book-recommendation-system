import React, { useState, useEffect } from 'react';
import fetchBooks, { fetchBooksMany } from '../services/googleBooks';
import apiService from '../services/api';
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

// ExploreCover: renders a fixed-size cover frame (180x270) and handles missing/failed images.
function ExploreCover({ primary, fallback, title }) {
  const [current, setCurrent] = React.useState(primary || fallback || null);
  const [failed, setFailed] = React.useState(false);

  const placeholderSvg = encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='1' height='1' viewBox='0 0 1 1' preserveAspectRatio='none'>
      <defs>
        <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
          <stop offset='0' stop-color='%23ffffff'/>
          <stop offset='1' stop-color='%23f4f4f4'/>
        </linearGradient>
      </defs>
      <rect width='1' height='1' fill='url(#g)'/>
    </svg>
  `);

  // If no src or a previous load failed, show the same placeholder used in the
  // main tiles so Explore matches the site's visual style.
  const handleError = (e) => {
    if(current && primary && current === primary && fallback){
      setCurrent(fallback);
      return;
    }
    setFailed(true);
    // Hide this card completely when we have no valid image
    try {
      const card = e.currentTarget.closest('.book-tile');
      if (card) card.style.display = 'none';
    } catch(_) {}
  };

  if (!current || failed) {
    return null;
  }

  return (
    <div className="book-cover-wrap">
      <img
        className="book-cover book-cover--strict"
        src={current}
        alt={title}
        onError={handleError}
      />
    </div>
  );
}

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
  const [query, setQuery] = useState('bestsellers');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Type a search and press Enter');
  const [favorites, setFavorites] = useState(userDataManager ? userDataManager.getData('favorites', []) : []);
  const [loading, setLoading] = useState(false);
  

  useEffect(()=>{
    load(query);
  },[]);

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

  async function load(q){
    setStatus('Searching...');
    setItems([]);
    setLoading(true);
    try{
      // We want to show up to this many valid tiles after filtering
      const target = 40;
      // Fetch a larger pool so we can filter aggressively without empty spots
      let pool = [];
      const mapped = mapAuthorQuery(q);
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

      const filtered = [];
      const seen = new Set();
      for (const item of pool) {
        const info = item.volumeInfo || {};
        const title = (info.title || '').trim().toLowerCase();
        if (BLOCKED.ids.has(item.id) || BLOCKED.titles.has(title)) continue;
        if (!hasCover(info)) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        filtered.push(item);
        if (filtered.length >= target) break;
      }

      // If we didn't get enough results, try an author-focused fallback
      if (filtered.length < target) {
        try {
          const authorPool = await fetchBooksMany(`inauthor:${q}`, 200);
          for (const item of authorPool) {
            const info = item.volumeInfo || {};
            const title = (info.title || '').trim().toLowerCase();
            if (BLOCKED.ids.has(item.id) || BLOCKED.titles.has(title)) continue;
            if (!hasCover(info)) continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            filtered.push(item);
            if (filtered.length >= target) break;
          }
        } catch (e) {
          // ignore author fallback failures
        }
      }

      setItems(filtered);
      setStatus(filtered.length ? `Showing ${filtered.length} results` : 'No results');
    }catch(e){
      console.error(e);
      setStatus('Could not fetch books');
    }
    setLoading(false);
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
          <button className="pill" onClick={()=>{setQuery('subject:fiction'); load('subject:fiction')}}>Fiction</button>
          <button className="pill" onClick={()=>{setQuery('subject:nonfiction'); load('subject:nonfiction')}}>Non‑Fiction</button>
          <button className="pill" onClick={()=>{setQuery('intitle:classics'); load('intitle:classics')}}>Classics</button>
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
          if(!openLib && !thumbHigh){
            return null;
          }

          return (
            <div key={item.id} className="book-tile">
              <article className="book-card">
                <div className="book-cover-wrap">
                  <ExploreCover primary={openLib} fallback={thumbHigh} title={title} />
                </div>
                <div className="book-info">
                  <h3 className="book-title">{title}</h3>
                  <p className="book-authors">{authors}</p>
                  <div className="card-footer">
                    <a className="view-link" href={info.infoLink} target="_blank" rel="noopener noreferrer">View</a>
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
