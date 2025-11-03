import React, { useState, useEffect } from 'react';
import MoodSelector from './MoodSelector';
import GoogleSignInButton from './GoogleSignInButton';
import BookImage from './BookImage';
// import RecentlyViewed from './RecentlyViewed';
import { getRecommendations, getTrendingBooks } from '../services/recommendations2';
import fetchBooks from '../services/googleBooks';

/**
 * DiscoverPage - AI-powered book discovery with mood and genre filters
 * Beautiful, responsive layout similar to Spotify/Goodreads
 */

const GENRES = [
  { id: 'all', label: 'All Genres', emoji: '📚' },
  { id: 'fiction', label: 'Fiction', emoji: '📖' },
  { id: 'mystery', label: 'Mystery', emoji: '🔍' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'scifi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'thriller', label: 'Thriller', emoji: '😱' },
  { id: 'nonfiction', label: 'Non-Fiction', emoji: '📰' },
  { id: 'biography', label: 'Biography', emoji: '👤' },
  { id: 'history', label: 'History', emoji: '🏛️' }
];

export default function DiscoverPage({ userDataManager }) {
  // Local fallback dataset used when remote calls fail or time out.
  const SAMPLE_BOOKS = [
    {
      id: 'sample-1',
      title: 'The Little Guide to Joy',
      author: 'A. Reader',
      authors: ['A. Reader'],
      cover: '/assets/default_cover.svg',
      thumbnail: '/assets/default_cover.svg',
      description: 'A short, uplifting collection of essays and micro-stories to brighten your day.',
      averageRating: 4.5,
      infoLink: '#'
    },
    {
      id: 'sample-2',
      title: 'Mysteries of the Nightfall',
      author: 'S. Noir',
      authors: ['S. Noir'],
      cover: '/assets/default_cover.svg',
      thumbnail: '/assets/default_cover.svg',
      description: 'A gripping mystery that explores secrets hidden in a small town.',
      averageRating: 4.2,
      infoLink: '#'
    },
    {
      id: 'sample-3',
      title: 'Spaceways: A Beginner\'s Guide to the Stars',
      author: 'C. Astro',
      authors: ['C. Astro'],
      cover: '/assets/default_cover.svg',
      thumbnail: '/assets/default_cover.svg',
      description: 'An accessible and fun introduction to the wonders of space and science fiction.',
      averageRating: 4.7,
      infoLink: '#'
    }
  ];

  const [fallbackActive, setFallbackActive] = useState(false);
  // When true, show only the recommendations area (hide mood grid / trending)
  const [showOnlyRecommendations, setShowOnlyRecommendations] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [books, setBooks] = useState([]);
  const [trendingBooks, setTrendingBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [favorites, setFavorites] = useState([]);
  // seed to reshuffle recommendation results for the same mood/genre
  const [recoSeed, setRecoSeed] = useState(0);

  // dark mode state (persisted in localStorage)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('vibesphere_theme') === 'dark'; } catch(e){ return false; }
  });

  useEffect(() => {
    try {
      if (dark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('vibesphere_theme', dark ? 'dark' : 'light');
    } catch (e) { /* ignore */ }
  }, [dark]);

  // Helper to record book to history
  const recordHistory = (book) => {
    try {
      const entry = {
        id: book.id,
        title: book.title,
        authors: book.author || book.authors?.join(', ') || 'Unknown',
        cover: book.cover || book.thumbnail,
        infoLink: book.infoLink
      };
      
      if (userDataManager) {
        const cur = userDataManager.getData('history', []) || [];
        const next = [entry, ...cur.filter((h) => h.id !== book.id)].slice(0, 24);
        userDataManager.saveData('history', next);
      } else {
        const raw = localStorage.getItem('vibesphere_guest_history');
        const cur = raw ? JSON.parse(raw) : [];
        const next = [entry, ...cur.filter((h) => h.id !== book.id)].slice(0, 24);
        localStorage.setItem('vibesphere_guest_history', JSON.stringify(next));
      }
      // Dispatch custom event so RecentlyViewed component updates immediately
      window.dispatchEvent(new CustomEvent('historyUpdated'));
    } catch (e) {
      console.error('Failed to record history:', e);
    }
  };

  // Load favorites
  useEffect(() => {
    if (userDataManager) {
      setFavorites(userDataManager.getData('favorites', []));
    }
  }, [userDataManager]);

  // Load trending books on mount
  useEffect(() => {
    loadTrendingBooks();
  }, []);

  // Load recommendations when mood or genre changes
  useEffect(() => {
    if (selectedMood || selectedGenre !== 'all') {
      loadRecommendations();
    }
  }, [selectedMood, selectedGenre, recoSeed]);

  // If a mood or a non-default genre is active, switch into "show only"
  // recommendations mode so unrelated UI is hidden (matches requested UX).
  useEffect(() => {
    if (selectedMood || (selectedGenre && selectedGenre !== 'all')) {
      setShowOnlyRecommendations(true);
    } else {
      setShowOnlyRecommendations(false);
    }
  }, [selectedMood, selectedGenre]);

  async function loadTrendingBooks() {
    try {
      setLoadingTrending(true);
      
      // Fetch trending books from backend (Google Books + Open Library)
      const formatted = await getTrendingBooks(20);
      
      if (!formatted || formatted.length === 0) {
        // activate fallback when upstream returned no usable items
        setFallbackActive(true);
        setTrendingBooks(SAMPLE_BOOKS.slice(0, 10));
      } else {
        setTrendingBooks(formatted);
      }
    } catch (error) {
      console.error('Error loading trending books:', error);
      // On error, enable client-side fallback so the page remains useful
      setFallbackActive(true);
      setTrendingBooks(SAMPLE_BOOKS.slice(0, 10));
    } finally {
      setLoadingTrending(false);
    }
  }

  async function loadRecommendations() {
    try {
      setLoading(true);
      const genre = selectedGenre === 'all' ? '' : selectedGenre;
      
      // Fetch recommendations from backend API with mood and genre filters
      const formatted = await getRecommendations(selectedMood || '', genre, 40, recoSeed || undefined);
      
      if (!formatted || formatted.length === 0) {
        setFallbackActive(true);
        setBooks(SAMPLE_BOOKS.slice(0, 20));
      } else {
        setBooks(formatted);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setFallbackActive(true);
      setBooks(SAMPLE_BOOKS.slice(0, 20));
    } finally {
      setLoading(false);
    }
  }

  function toggleFavorite(book) {
    if (!userDataManager) return;
    const fav = userDataManager.getData('favorites', []);
    const exists = fav.find(b => b.id === book.id);
    let updated;
    if (exists) {
      updated = fav.filter(b => b.id !== book.id);
    } else {
      updated = [
        {
          id: book.id,
          title: book.title,
          authors: book.author || book.authors?.join(', ') || 'Unknown',
          cover: book.cover || book.thumbnail
        },
        ...fav
      ];
    }
    userDataManager.saveData('favorites', updated);
    setFavorites(updated);
  }

  const isFavorite = (bookId) => favorites.some(f => f.id === bookId);

  return (
    <div className="discover-page max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 data-testid="main-heading" className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Discover Your Next Favorite Book
        </h1>
        <p className="text-lg text-slate-600">
          AI-powered recommendations based on your mood and preferences
        </p>
  {/* build tag removed */}
        {fallbackActive && (
          <div className="mt-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
            You're seeing fallback recommendations because remote data couldn't be loaded. This is temporary — the live recommender will show here when available.
          </div>
        )}
      </div>

      {/* Mood Selector - Always visible */}
      <div className="modern-card p-6 mb-8">
        <MoodSelector
          selectedMood={selectedMood}
          onMoodChange={(m) => { setSelectedMood(m); setSelectedGenre('all'); }}
        />
      </div>

      {/* Clear mood selection link shown when a mood is active */}
      {selectedMood && (
        <div className="text-center mb-6">
          <button
            className="text-sm text-indigo-600 hover:underline"
            onClick={() => { setSelectedMood(null); setShowOnlyRecommendations(false); }}
          >
            Clear mood selection
          </button>
        </div>
      )}

      {/* Genre Filter */}
      <div className="modern-card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span>Filter by Genre</span>
          </h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {GENRES.map(genre => (
            <button
              key={genre.id}
              onClick={() => { setSelectedGenre(genre.id); setShowOnlyRecommendations(true); setSelectedMood(null); }}
              data-testid={`genre-${genre.id}`}
              className={`
                px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2
                ${selectedGenre === genre.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }
              `}
            >
              <span className="text-lg">{genre.emoji}</span>
              <span>{genre.label}</span>
            </button>
          ))}
        </div>
        {showOnlyRecommendations && (
          <div className="mt-4">
            <button
              className="text-sm text-indigo-600 hover:underline"
              onClick={() => { setSelectedGenre('all'); setSelectedMood(null); setShowOnlyRecommendations(false); }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      {(selectedMood || selectedGenre !== 'all') && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <span className="text-2xl">📚</span>
              <span>{selectedMood ? `${selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)} Reads` : 'Recommendations'}</span>
            </h2>
              <div className="flex items-center gap-3">
                <button
                  className="text-sm px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                  onClick={() => setRecoSeed(Date.now())}
                  title="Load a different set"
                >
                  Shuffle
                </button>
                <span className="text-sm text-slate-500" data-testid="books-found-count">
                  {books.length} books found
                </span>
              </div>
          </div>

          {loading ? (
            <LoadingGrid />
          ) : books.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {books.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  isFavorite={isFavorite(book.id)}
                  onToggleFavorite={toggleFavorite}
                  onView={recordHistory}
                />
              ))}
            </div>
          ) : (
            <div className="text-center modern-card rounded-2xl py-20 px-6">
              <p className="text-slate-500 text-xl md:text-2xl">
                No books found for this combination. Try a different mood or genre!
              </p>
              <div className="mt-4 text-sm text-slate-400">0 books found</div>
            </div>
          )}
        </div>
      )}

      {/* Trending Books Section (hidden when compact "show only" mode is active) */}
      {!showOnlyRecommendations && (
        <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            🔥 Currently Trending
          </h2>
        </div>

        {loadingTrending ? (
          <LoadingGrid count={10} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {trendingBooks.map(book => (
              <BookCard
                key={book.id}
                book={book}
                isFavorite={isFavorite(book.id)}
                onToggleFavorite={toggleFavorite}
                onView={recordHistory}
              />
            ))}
          </div>
        )}
        </div>
      )}
    </div>
  );
}

function BookCard({ book, isFavorite, onToggleFavorite, onView }) {
  const handleViewClick = () => {
    if (onView) onView(book);
  };

  return (
    <article className="book-card group animate-fade-in">
      <div className="relative overflow-hidden rounded-xl mb-3">
        <BookImage
          primaryUrl={book.cover || book.thumbnail}
          secondaryUrl={book.cover && book.thumbnail && book.cover !== book.thumbnail ? book.thumbnail : undefined}
          altIdentifiers={{ isbn: book.isbn }}
          title={book.title}
          author={book.author}
          className="w-full aspect-[2/3] object-cover group-hover:scale-110 transition-transform duration-500"
        />
        
        {/* Favorite button */}
        <button
          onClick={() => onToggleFavorite(book)}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-lg hover:scale-110 transition-transform duration-200 shadow-lg"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          data-testid={`fav-btn-${book.id}`}
        >
          {isFavorite ? '💖' : '🤍'}
        </button>

        {/* Rating badge */}
        {book.averageRating > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs font-semibold flex items-center gap-1">
            <span>⭐</span>
            <span>{book.averageRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="px-1">
        <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 mb-1">
          {book.title}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-1 mb-2">
          {book.author || book.authors?.join(', ') || 'Unknown Author'}
        </p>
        
        {book.description && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-3">
            {book.description}
          </p>
        )}

        <a
          href={book.infoLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleViewClick}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
        >
          View Details →
        </a>
      </div>
    </article>
  );
}

function LoadingGrid({ count = 20 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-slate-200 aspect-[2/3] rounded-xl mb-3" />
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
