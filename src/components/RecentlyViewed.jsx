import React, { useEffect, useState } from 'react';

// Helper to create SVG placeholder
function createPlaceholder(title) {
  const encoded = encodeURIComponent(title.substring(0, 30));
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='270' viewBox='0 0 180 270'%3E%3Crect fill='%23e2e8f0' width='180' height='270'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='14' fill='%2364748b' text-length='160'%3E${encoded}%3C/text%3E%3C/svg%3E`;
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
            {history.map((h) => {
              console.log('📚 Recently Viewed item:', h.title, 'Cover:', h.cover);
              return <HistoryBookCard key={h.id} book={h} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// BookCard component for history items
function HistoryBookCard({ book }) {
  const [imgSrc, setImgSrc] = useState(book.cover || createPlaceholder(book.title));
  const [imgError, setImgError] = useState(false);

  const handleImageError = () => {
    console.log('❌ Image failed:', book.cover, 'for book:', book.title);
    if (!imgError) {
      setImgError(true);
      setImgSrc(createPlaceholder(book.title));
    }
  };

  return (
    <div className="w-56 flex-shrink-0">
      <div className="book-tile">
        <article className="book-card">
          <div className="book-cover-wrap">
            <img 
              className="book-cover" 
              src={imgSrc} 
              alt={`${book.title} cover`}
              onError={handleImageError}
            />
          </div>
          <div className="book-info">
            <h4 className="book-title">{book.title}</h4>
            <p className="book-authors">{book.authors}</p>
            <div className="mt-auto flex items-center gap-2">
              <a className="view-link" href={book.infoLink} target="_blank" rel="noopener noreferrer">View</a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
