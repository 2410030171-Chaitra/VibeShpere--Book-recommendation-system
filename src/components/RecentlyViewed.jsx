import React, { useEffect, useState } from 'react';

// Helper to create a beautiful book-like fallback cover
function createBookCover(title, author = '') {
  const colors = [
    { bg: '%234f46e5', text: '%23ffffff' }, // indigo
    { bg: '%2306b6d4', text: '%23ffffff' }, // cyan
    { bg: '%2310b981', text: '%23ffffff' }, // emerald
    { bg: '%23f59e0b', text: '%23ffffff' }, // amber
    { bg: '%23ec4899', text: '%23ffffff' }, // pink
    { bg: '%238b5cf6', text: '%23ffffff' }, // violet
  ];
  
  const colorIndex = title.length % colors.length;
  const color = colors[colorIndex];
  
  const titleShort = encodeURIComponent(title.substring(0, 40));
  const authorShort = author ? encodeURIComponent(author.substring(0, 30)) : '';
  
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='270' viewBox='0 0 180 270'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:${color.bg};stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:${color.bg};stop-opacity:0.8' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='180' height='270' fill='url(%23grad)'/%3E%3Crect x='10' y='20' width='160' height='3' fill='${color.text}' opacity='0.3'/%3E%3Ctext x='90' y='130' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='16' font-weight='bold' fill='${color.text}' style='word-spacing: 100vw;'%3E${titleShort}%3C/text%3E%3Ctext x='90' y='160' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='12' fill='${color.text}' opacity='0.9'%3E${authorShort}%3C/text%3E%3Crect x='10' y='247' width='160' height='3' fill='${color.text}' opacity='0.3'/%3E%3C/svg%3E`;
}

// HistoryBookCard: renders a single history item with smart cover image handling
function HistoryBookCard({ h }) {
  const [imgSrc, setImgSrc] = useState(h.cover || createBookCover(h.title, h.authors));
  const [attemptedFallback, setAttemptedFallback] = useState(false);

  const handleError = async (e) => {
    e.currentTarget.onerror = null;
    
    // Try fetching from Google Books API once
    if (!attemptedFallback) {
      setAttemptedFallback(true);
      
      try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(h.title)}&maxResults=1`);
        const data = await response.json();
        
        if (data.items && data.items[0]) {
          const bookData = data.items[0].volumeInfo;
          const thumbnail = bookData.imageLinks?.thumbnail || bookData.imageLinks?.smallThumbnail;
          
          if (thumbnail) {
            const httpsThumb = thumbnail.replace(/^http:/, 'https:');
            setImgSrc(httpsThumb);
            return;
          }
        }
      } catch (err) {
        console.log('Could not fetch fallback cover:', err);
      }
    }
    
    // Final fallback: show beautiful book cover
    setImgSrc(createBookCover(h.title, h.authors));
  };

  return (
    <div className="w-56 flex-shrink-0">
      <div className="book-tile">
        <article className="book-card">
          <div className="book-cover-wrap">
            <img 
              src={imgSrc}
              alt={h.title} 
              className="book-cover"
              loading="lazy"
              onError={handleError}
            />
          </div>
          <div className="book-info">
            <h4 className="book-title">{h.title}</h4>
            <p className="book-authors">{h.authors}</p>
            <div className="mt-auto flex items-center gap-2">
              <a className="view-link" href={h.infoLink} target="_blank" rel="noopener noreferrer">View</a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

// RecentlyViewed shows a horizontal list of books the user opened recently.
// It reads/writes from the provided `userDataManager` or from localStorage as a fallback.
export default function RecentlyViewed({ userDataManager }) {
  const [history, setHistory] = useState([]);

  const readHistory = () => {
    try {
      if (userDataManager) {
        const hist = userDataManager.getData('history', []) || [];
        console.log('📖 RecentlyViewed: Read from userDataManager, got', hist.length, 'items');
        return hist;
      }
      const raw = localStorage.getItem('vibesphere_guest_history');
      const hist = raw ? JSON.parse(raw) : [];
      console.log('📖 RecentlyViewed: Read from localStorage, got', hist.length, 'items');
      return hist;
    } catch (e) {
      console.error('❌ RecentlyViewed: Failed to read history:', e);
      return [];
    }
  };

  useEffect(() => {
    console.log('🔄 RecentlyViewed: Component mounted/updated, userDataManager:', !!userDataManager);
    setHistory(readHistory());
    
    // Listen for custom history update events from same page
    const onHistoryUpdate = () => {
      console.log('🔔 RecentlyViewed: Received historyUpdated event');
      setHistory(readHistory());
    };
    
    // Listen to storage events for updates from other tabs
    const onStorage = (e) => {
      if (e.key && e.key.includes('history')) {
        console.log('🔔 RecentlyViewed: Received storage event');
        setHistory(readHistory());
      }
    };
    
    window.addEventListener('historyUpdated', onHistoryUpdate);
    window.addEventListener('storage', onStorage);
    
    return () => {
      window.removeEventListener('historyUpdated', onHistoryUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [userDataManager]);

  const clearHistory = () => {
    try {
      if (userDataManager) {
        userDataManager.saveData('history', []);
      } else {
        localStorage.removeItem('vibesphere_guest_history');
      }
      setHistory([]);
    } catch (e) {
      setHistory([]);
    }
  };

  return (
    <div className="modern-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-800 mb-1">🕒 Recently Viewed</h3>
          <p className="text-sm text-slate-500">Quick access to titles you opened</p>
        </div>
        <div>
          <button
            className="px-3 py-1.5 rounded-lg text-sm border bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40"
            onClick={clearHistory}
            disabled={!history || history.length === 0}
          >
            Clear History
          </button>
        </div>
      </div>

      {!history || history.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <div className="text-3xl mb-2">📖</div>
          <div className="font-medium">No recently viewed titles</div>
          <div className="text-sm mt-1">Open a book and it will show up here for quick access.</div>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-3 py-2">
          <div className="flex gap-4 px-3">
            {history.map((h) => (
              <HistoryBookCard key={h.id} h={h} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
