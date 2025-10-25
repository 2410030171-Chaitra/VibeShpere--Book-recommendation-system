import React, { useState, useEffect } from 'react';
import fetchBooks, { fetchBooksMany } from '../services/googleBooks';
import apiService from '../services/api';
import BookImage from './BookImage';
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

export default function GoogleBooksGallery({ userDataManager }) {
  // Helper to record book to history
  const recordHistory = (item) => {
    try {
      const info = item.volumeInfo || {};
      const title = info.title || 'Untitled';
      const authors = (info.authors || []).join(', ');
      
      // Get best cover
      const isbn = getBestIsbn(info);
      const openLib = openLibCoverUrl(isbn);
      const googleThumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;
      const cover = openLib || (googleThumb ? googleThumb.replace(/^http:/, 'https:') : undefined);
      
      const entry = { id: item.id, title, authors, cover, infoLink: info.infoLink };
      
      if (userDataManager) {
        const cur = userDataManager.getData('history', []) || [];
        const next = [entry, ...cur.filter((h) => h.id !== item.id)].slice(0, 24);
        userDataManager.saveData('history', next);
      } else {
        const raw = localStorage.getItem('vibesphere_guest_history');
        const cur = raw ? JSON.parse(raw) : [];
        const next = [entry, ...cur.filter((h) => h.id !== item.id)].slice(0, 24);
        localStorage.setItem('vibesphere_guest_history', JSON.stringify(next));
      }
      // Dispatch custom event so RecentlyViewed component updates immediately
      window.dispatchEvent(new CustomEvent('historyUpdated'));
    } catch (e) {
      console.error('Failed to record history:', e);
    }
  };
  
  // Temporary blocklist to remove problematic or unwanted books from Explore
  // You can extend these lists with more titles or exact volume IDs.
  const BLOCKED = {
    titles: new Set([
      'bestsellers, 1979-1983',
      'bestsellers of the third reich',
    ]),
    ids: new Set([
      // Add volume IDs here to block by exact Google volume id
    ]),
  };
  const [query, setQuery] = useState(''); // Empty by default - no auto-search
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Search for books, authors, or genres');
  const [favorites, setFavorites] = useState(userDataManager ? userDataManager.getData('favorites', []) : []);
  const [loading, setLoading] = useState(false);
  

  useEffect(()=>{
    if (query && query.trim()) {
      load(query);
    }
  },[]);

  function mapAuthorQuery(raw){
    const s = String(raw || '').trim();
    
    // Already formatted queries
    if (s.startsWith('inauthor:') || s.startsWith('intitle:') || s.startsWith('subject:')) {
      return s;
    }
    
    // Explicit prefixes only
    const authorM = s.match(/^author\s*:\s*(.+)$/i);
    const byM = s.match(/^by\s+(.+)$/i);
    if (authorM) return `inauthor:${authorM[1]}`;
    if (byM) return `inauthor:${byM[1]}`;
    
    const genreM = s.match(/^genre\s*:\s*(.+)$/i);
    if (genreM) return `subject:${genreM[1]}`;
    
    // Smart detection: if it looks like a person's name, treat as author
    // (2-3 words, mostly letters, capitalized like "First Last" or "First Middle Last")
    const namePattern = /^[A-Z][a-z]+(\s+[A-Z]\.?\s*)?(\s+[A-Z][a-z]+){1,2}$/;
    if (namePattern.test(s)) {
      return `inauthor:${s}`;
    }
    
    // Otherwise return as-is for general search (title, keywords)
    return s;
  }

  async function load(q){
    setStatus('Searching...');
    setItems([]);
    setLoading(true);
    try{
      const target = 60;
      const mapped = mapAuthorQuery(q);
      
      // Detect search type
      const isAuthorSearch = mapped.startsWith('inauthor:');
      const isTitleSearch = mapped.startsWith('intitle:');
      const searchAuthor = isAuthorSearch ? mapped.replace('inauthor:', '').trim().toLowerCase() : '';
      const searchTitle = isTitleSearch ? mapped.replace('intitle:', '').trim().toLowerCase() : '';
      const searchQuery = (!isAuthorSearch && !isTitleSearch) ? q.trim().toLowerCase() : '';
      
      console.log('🔍 Searching for:', q);
      console.log('📝 Mapped query:', mapped);
      
      // Use Google Books API directly for best cover images and results
      const pool = await fetchBooksMany(mapped || q, 200);
      console.log('✅ Google Books returned:', pool.length, 'books');
      
      // Helpers for filtering
      const hasCover = (info) => {
        const isbn = getBestIsbn(info);
        const openLib = openLibCoverUrl(isbn);
        const g = info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail;
        return !!(openLib || g);
      };
      
      // Strict filtering for ALL search types
      const matchesSearch = (item) => {
        const info = item.volumeInfo || {};
        
        // Author search - strict author matching
        if (isAuthorSearch && searchAuthor) {
          const authors = info.authors || [];
          return authors.some(author => {
            const authorLower = String(author || '').toLowerCase();
            const nameParts = searchAuthor.split(' ').filter(p => p.length > 2);
            return authorLower.includes(searchAuthor) || 
                   nameParts.every(part => authorLower.includes(part));
          });
        }
        
        // Title search - strict title matching
        if (isTitleSearch && searchTitle) {
          const title = String(info.title || '').toLowerCase();
          const titleParts = searchTitle.split(' ').filter(p => p.length > 2);
          return title.includes(searchTitle) || 
                 titleParts.every(part => title.includes(part));
        }
        
        // General search - more lenient matching for broader results
        if (searchQuery) {
          const title = String(info.title || '').toLowerCase();
          const authors = (info.authors || []).join(' ').toLowerCase();
          const description = String(info.description || '').toLowerCase();
          
          // For single word searches like "bestsellers", be more lenient
          if (searchQuery.split(' ').length === 1) {
            return title.includes(searchQuery) || 
                   authors.includes(searchQuery) ||
                   description.includes(searchQuery);
          }
          
          // For multi-word searches, match parts in title or author
          const queryParts = searchQuery.split(' ').filter(p => p.length > 2);
          return title.includes(searchQuery) || 
                 authors.includes(searchQuery) ||
                 queryParts.some(part => title.includes(part) || authors.includes(part));
        }
        
        return true;
      };

      // Filter and deduplicate
      const filtered = [];
      const seen = new Set();
      for (const item of pool) {
        const info = item.volumeInfo || {};
        const title = (info.title || '').trim().toLowerCase();
        if (BLOCKED.ids.has(item.id) || BLOCKED.titles.has(title)) continue;
        if (!hasCover(info)) continue;
        if (!matchesSearch(item)) continue; // Strict filtering for ALL searches
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        filtered.push(item);
        if (filtered.length >= target) break;
      }

      console.log('📊 Final results:', filtered.length, 'books');
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

          // Always show books, even without covers (will use fallback)
          return (
            <div key={item.id} className="book-tile">
              <article className="book-card">
                <div className="book-cover-wrap">
                  <BookImage
                    primaryUrl={thumbHigh}
                    altIdentifiers={{ isbn }}
                    title={title}
                    author={authors}
                    className="book-cover"
                  />
                </div>
                <div className="book-info">
                  <h3 className="book-title">{title}</h3>
                  <p className="book-authors">{authors}</p>
                  <div className="card-footer">
                    <a className="view-link" href={info.infoLink} target="_blank" rel="noopener noreferrer" onClick={() => recordHistory(item)}>View</a>
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
