import React, { useEffect, useState } from 'react';
import BookImage from './BookImage';

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
              <div key={h.id} className="w-56 flex-shrink-0">
                <div className="book-tile">
                  <article className="book-card">
                    <div className="book-cover-wrap">
                      <BookImage
                        primaryUrl={h.cover}
                        altIdentifiers={{ isbn: h.isbn }}
                        title={h.title}
                        author={h.authors}
                        className="book-cover"
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
