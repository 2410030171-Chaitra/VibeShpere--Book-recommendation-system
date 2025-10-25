import React, { useState, useEffect } from 'react';
import MoodSelector from './MoodSelector';
import BookImage from './BookImage';
import { getRecommendations, getTrendingBooks } from '../services/recommendations';
import fetchBooks from '../services/googleBooks';

/**
 * DiscoverPage - AI-powered book discovery with mood and genre filters
 * Beautiful, responsive layout similar to Spotify/Goodreads
 */

const GENRES = [
  { id: 'all', label: 'All Genres', emoji: '📚' },
  { id: 'fiction', label: 'Fiction', emoji: '📖' },
  { id: 'mystery', label: 'Mystery', emoji: '🔍' },
  { id: 'romance', label: 'Romance', emoji: '💕' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'scifi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'thriller', label: 'Thriller', emoji: '😱' },
  { id: 'nonfiction', label: 'Non-Fiction', emoji: '📰' },
  { id: 'biography', label: 'Biography', emoji: '👤' },
  { id: 'history', label: 'History', emoji: '🏛️' }
];

export default function DiscoverPage({ userDataManager }) {
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [books, setBooks] = useState([]);
  const [trendingBooks, setTrendingBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [favorites, setFavorites] = useState([]);

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
  }, [selectedMood, selectedGenre]);

  async function loadTrendingBooks() {
    try {
      setLoadingTrending(true);
      const trending = await getTrendingBooks(20);
      
      // If backend fails or returns empty, use Google Books as fallback
      if (!trending || trending.length === 0) {
        console.log('📚 Backend unavailable, using Google Books for trending...');
        const googleTrending = await fetchBooks('bestsellers OR popular OR trending', 20);
        const formatted = googleTrending.map(item => ({
          id: item.id,
          title: item.volumeInfo?.title || 'Untitled',
          author: (item.volumeInfo?.authors || []).join(', ') || 'Unknown',
          authors: item.volumeInfo?.authors || [],
          cover: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          thumbnail: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          description: item.volumeInfo?.description || '',
          averageRating: item.volumeInfo?.averageRating || 0,
          infoLink: item.volumeInfo?.infoLink || ''
        }));
        setTrendingBooks(formatted);
      } else {
        setTrendingBooks(trending);
      }
    } catch (error) {
      console.error('Error loading trending books:', error);
      // Fallback to Google Books on error
      try {
        const googleTrending = await fetchBooks('bestsellers OR popular', 20);
        const formatted = googleTrending.map(item => ({
          id: item.id,
          title: item.volumeInfo?.title || 'Untitled',
          author: (item.volumeInfo?.authors || []).join(', ') || 'Unknown',
          authors: item.volumeInfo?.authors || [],
          cover: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          thumbnail: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          description: item.volumeInfo?.description || '',
          averageRating: item.volumeInfo?.averageRating || 0,
          infoLink: item.volumeInfo?.infoLink || ''
        }));
        setTrendingBooks(formatted);
      } catch (fallbackError) {
        console.error('Google Books fallback also failed:', fallbackError);
        setTrendingBooks([]);
      }
    } finally {
      setLoadingTrending(false);
    }
  }

  async function loadRecommendations() {
    try {
      setLoading(true);
      const genre = selectedGenre === 'all' ? '' : selectedGenre;
      const recommended = await getRecommendations(selectedMood, genre, 40);
      
      // If backend fails or returns empty, use Google Books as fallback
      if (!recommended || recommended.length === 0) {
        console.log('📚 Backend unavailable, using Google Books for recommendations...');
        const query = [selectedMood, genre].filter(Boolean).join(' ') || 'popular books';
        const googleBooks = await fetchBooks(query, 40);
        const formatted = googleBooks.map(item => ({
          id: item.id,
          title: item.volumeInfo?.title || 'Untitled',
          author: (item.volumeInfo?.authors || []).join(', ') || 'Unknown',
          authors: item.volumeInfo?.authors || [],
          cover: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          thumbnail: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          description: item.volumeInfo?.description || '',
          averageRating: item.volumeInfo?.averageRating || 0,
          infoLink: item.volumeInfo?.infoLink || ''
        }));
        setBooks(formatted);
      } else {
        setBooks(recommended);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      // Fallback to Google Books on error
      try {
        const query = [selectedMood, genre].filter(Boolean).join(' ') || 'fiction';
        const googleBooks = await fetchBooks(query, 40);
        const formatted = googleBooks.map(item => ({
          id: item.id,
          title: item.volumeInfo?.title || 'Untitled',
          author: (item.volumeInfo?.authors || []).join(', ') || 'Unknown',
          authors: item.volumeInfo?.authors || [],
          cover: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          thumbnail: item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail || '',
          description: item.volumeInfo?.description || '',
          averageRating: item.volumeInfo?.averageRating || 0,
          infoLink: item.volumeInfo?.infoLink || ''
        }));
        setBooks(formatted);
      } catch (fallbackError) {
        console.error('Google Books fallback also failed:', fallbackError);
        setBooks([]);
      }
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
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Discover Your Next Favorite Book
        </h1>
        <p className="text-lg text-slate-600">
          AI-powered recommendations based on your mood and preferences
        </p>
      </div>

      {/* Mood Selector */}
      <div className="modern-card p-6 mb-8">
        <MoodSelector
          selectedMood={selectedMood}
          onMoodChange={setSelectedMood}
        />
      </div>

      {/* Genre Filter */}
      <div className="modern-card p-6 mb-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          📚 Filter by Genre
        </h3>
        <div className="flex flex-wrap gap-2">
          {GENRES.map(genre => (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.id)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${selectedGenre === genre.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-105'
                }
              `}
            >
              <span className="mr-2">{genre.emoji}</span>
              {genre.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations Section */}
      {(selectedMood || selectedGenre !== 'all') && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              {selectedMood ? `📚 ${selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)} Reads` : '📚 Recommendations'}
            </h2>
            <span className="text-sm text-slate-500">
              {books.length} books found
            </span>
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
            <div className="text-center py-12 modern-card">
              <p className="text-slate-500 text-lg">
                No books found for this combination. Try a different mood or genre!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Trending Books Section */}
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
