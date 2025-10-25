import React, { useMemo, useState, useEffect, useRef } from "react";
import GoogleBooksGallery from "./src/components/GoogleBooksGallery.jsx";
import DiscoverPage from "./src/components/DiscoverPage.jsx";
import GoogleSignInButton from "./src/components/GoogleSignInButton.jsx";
import { signInWithGoogle, onAuthChange, logOut as firebaseLogOut } from "./src/services/firebaseAuth.js";
import fetchBooks, { fetchBooksMany } from "./src/services/googleBooks.js";
import RecentlyViewed from "./src/components/RecentlyViewed.jsx";
import { getTrendingBooks } from "./src/services/recommendations.js";
import apiService from "./src/services/api.js";

// Generate a simple SVG data-URL placeholder using the book title/author so
// each book has a unique fallback image when the remote cover fails.
function escapeSvgText(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Reusable cover image component that proactively verifies the provided src,
// attempts a Google Books thumbnail lookup if the src fails, and finally
// falls back to a unique SVG placeholder.
function CoverImage({ src, title, author, className, alt, style, loading = 'lazy' }) {
  const [coverSrc, setCoverSrc] = React.useState(src || svgPlaceholder(title, author));

  // Keep the initial src, but don't attempt to pre-fetch remote images (can be blocked by CORS).
  // Rely on the <img> element's natural load/error, then try Google Books, then SVG placeholder.
  React.useEffect(() => {
    setCoverSrc(src || svgPlaceholder(title, author));
  }, [src, title, author]);

  async function handleImgError(e) {
    try {
      e.currentTarget.onerror = null; // prevent loops
      // First try Google Books thumbnail
      const g = await fetchGoogleThumbnail(title, author);
      if (g) {
        e.currentTarget.src = g;
        return;
      }
    } catch (err) {
      // ignore and fall through to SVG
    }
    e.currentTarget.src = svgPlaceholder(title, author);
  }

  return (
    <img
      src={coverSrc}
      alt={alt || title}
      className={className}
      style={style}
      loading={loading}
      onError={handleImgError}
      onLoad={async (ev) => {
        try {
          const img = ev.currentTarget;
          // If the loaded image is very small (low-res thumbnail), attempt Google Books for a higher-res
          if (img.naturalWidth && img.naturalWidth < 120) {
            const g2 = await fetchGoogleThumbnail(title, author);
            if (g2 && g2 !== img.src) img.src = g2;
          }
        } catch (e) {
          // ignore
        }
      }}
    />
  );
}

function stringToColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
    h = h & h;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 90%)`;
}

function svgPlaceholder(title = '', subtitle = '') {
  const bg = stringToColor(title + subtitle);
  const t = escapeSvgText(title || 'Untitled');
  const s = escapeSvgText(subtitle || '');
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='600' height='900' viewBox='0 0 600 900'>
    <rect width='100%' height='100%' fill='${bg}' />
    <text x='50%' y='45%' text-anchor='middle' font-family='Georgia, serif' font-size='28' fill='#5b3b5b'>${t}</text>
    <text x='50%' y='55%' text-anchor='middle' font-family='Inter, system-ui, sans-serif' font-size='18' fill='#6b516b'>${s}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Try to fetch a thumbnail from Google Books for a given title/author. Returns thumbnail URL or null.
async function fetchGoogleThumbnail(title = '', author = '') {
  try {
    const q = encodeURIComponent(`intitle:${title}` + (author ? `+inauthor:${author}` : ''));
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.items && json.items[0];
    const info = item && item.volumeInfo;
    const thumb = info && (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail));
    return thumb ? thumb.replace(/^http:\/\//, 'https://') : null;
  } catch (e) {
    return null;
  }
}

// Shared handler used when an img fails to load. It will attempt Google Books lookup,
// then fallback to an SVG placeholder.
function handleImageErrorFactory(title, author) {
  return async function onImgError(e) {
    try {
      // prevent loops
      e.currentTarget.onerror = null;
      const g = await fetchGoogleThumbnail(title, author);
      if (g) {
        e.currentTarget.src = g;
        return;
      }
    } catch (err) {
      // ignore
    }
    e.currentTarget.src = svgPlaceholder(title, author);
  };
}

/**
 * VibeSphere — A serene, modern book recommendation website
 * Unique features: Hybrid filtering (content + collaborative)
 * Tech: React (single file), TailwindCSS classes, no external backend (mock data + localStorage)
 *
 * How to use in a real project:
 * - Drop this file into a fresh Vite + React + Tailwind project as App.jsx
 * - Ensure Tailwind is configured (https://tailwindcss.com/docs/guides/vite)
 * - Optional: Replace mock auth with Firebase/Auth0 and the mock data with your DB/API
 */

// -----------------------------
// Mock Data
// -----------------------------
const BOOKS = [
  // Fiction Books
  {
    id: "b1",
    title: "Whispers of the Valley",
    author: "Anita Rao",
    genres: ["Romance", "Contemporary", "Fiction"],
    tags: ["slow-burn", "heartwarming", "rural"],
    lengthHours: 6,
    summary: "A gentle tale of two strangers who find comfort and courage in a small valley town.",
    cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop",
    rating: 4.2,
    reviews: [
      { user: "BookLover23", rating: 5, comment: "Absolutely beautiful storytelling. Made me cry happy tears!" },
      { user: "RomanceReader", rating: 4, comment: "Sweet and slow-paced, perfect for a cozy weekend." }
    ]
  },
  {
    id: "b2",
    title: "The Clockmaker's Paradox",
    author: "Max Ellery",
    genres: ["Science Fiction", "Mystery", "Fiction"],
    tags: ["time travel", "twist", "clever"],
    lengthHours: 9,
    summary: "A sleuth entangled in a timeline he cannot trust, with clues hidden between tenses.",
    cover: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
    rating: 4.7,
    reviews: [
      { user: "SciFiGeek", rating: 5, comment: "Mind-bending plot that keeps you guessing until the end!" },
      { user: "MysteryFan", rating: 4, comment: "Clever writing, though it took me a while to follow the timeline." }
    ]
  },
  {
    id: "b3",
    title: "Ink & Ivory",
    author: "Zara Malik",
    genres: ["Literary", "Drama", "Fiction"],
    tags: ["coming-of-age", "art", "city"],
    lengthHours: 7,
    summary: "A young artist navigates love, loss, and ambition in a sprawling coastal city.",
    cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=600&auto=format&fit=crop",
    rating: 4.5,
    reviews: [
      { user: "ArtStudent", rating: 5, comment: "Captures the struggle of creative life perfectly." },
      { user: "CityLife", rating: 4, comment: "Beautiful descriptions of urban landscapes and human connections." }
    ]
  },
  {
    id: "b4",
    title: "Midnight in Kashi",
    author: "R. Sen",
    genres: ["Historical", "Mystery", "Fiction"],
    tags: ["India", "river", "rituals"],
    lengthHours: 5,
    summary: "An archivist uncovers a century-old secret along the ghats, where time moves like water.",
  cover: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop",
    rating: 4.3,
    reviews: [
      { user: "HistoryBuff", rating: 4, comment: "Rich cultural details and atmospheric setting." },
      { user: "IndianLit", rating: 5, comment: "Beautifully written with deep spiritual undertones." }
    ]
  },
  {
    id: "b5",
    title: "Quantum Tea & Other Stories",
    author: "J. Liu",
    genres: ["Short Stories", "Speculative", "Fiction"],
    tags: ["anthology", "imaginative", "bite-sized"],
    lengthHours: 3,
    summary: "Playful, thought-provoking shorts brewed with physics and feelings.",
    cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=600&auto=format&fit=crop",
    rating: 4.1,
    reviews: [
      { user: "ShortStoryLover", rating: 4, comment: "Creative and quirky collection. Some stories are brilliant!" },
      { user: "PhysicsTeacher", rating: 5, comment: "Love how science is woven into human stories." }
    ]
  },
  {
    id: "b6",
    title: "Edge of the Monsoon",
    author: "K. Narayan",
    genres: ["Adventure", "Thriller", "Fiction"],
    tags: ["coast", "storm", "survival"],
    lengthHours: 8,
    summary: "A rescue diver races against a deadly storm to uncover a smuggling ring at sea.",
    cover: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?q=80&w=600&auto=format&fit=crop",
    rating: 4.4,
    reviews: [
      { user: "ActionFan", rating: 5, comment: "Non-stop thrills and great character development!" },
      { user: "AdventureSeeker", rating: 4, comment: "Gripping story with excellent pacing." }
    ]
  },
  {
    id: "b7",
    title: "Algorithms for the Heart",
    author: "Priya Mehta",
    genres: ["Romance", "Humor", "Fiction"],
    tags: ["tech", "witty", "startup"],
    lengthHours: 4,
    summary: "Two rival engineers create a dating algorithm and accidentally optimize each other.",
    cover: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop",
    rating: 4.6,
    reviews: [
      { user: "TechRomance", rating: 5, comment: "Hilarious and heartwarming! Perfect for tech lovers." },
      { user: "ComedyReader", rating: 4, comment: "Witty dialogue and relatable characters." }
    ]
  },
  {
    id: "b8",
    title: "Mist Over Nilgiris",
    author: "Latha Iyer",
    genres: ["Mystery", "Drama", "Fiction"],
    tags: ["mountains", "family", "secrets"],
    lengthHours: 6,
    summary: "A botanist returns home to unravel the truth behind a long-guarded disappearance.",
  cover: "https://images.unsplash.com/photo-1520637836862-4d197d17c89a?q=80&w=600&auto=format&fit=crop",
    rating: 4.3,
    reviews: [
      { user: "MysteryLover", rating: 4, comment: "Atmospheric and suspenseful with beautiful descriptions." },
      { user: "NatureLover", rating: 5, comment: "Love the botanical elements woven into the mystery." }
    ]
  },
  // Non-Fiction Books
  {
    id: "b9",
    title: "The Art of Mindful Living",
    author: "Dr. Sarah Chen",
    genres: ["Self-Help", "Psychology", "Non-Fiction"],
    tags: ["mindfulness", "meditation", "wellness"],
    lengthHours: 4,
    summary: "A practical guide to incorporating mindfulness into everyday life for better mental health.",
    cover: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop",
    rating: 4.8,
    reviews: [
      { user: "WellnessJourney", rating: 5, comment: "Life-changing! Simple yet profound techniques." },
      { user: "BusyParent", rating: 5, comment: "Finally found mindfulness practices that fit my hectic schedule." }
    ]
  },
  {
    id: "b10",
    title: "Digital Minimalism",
    author: "Cal Newport",
    genres: ["Technology", "Lifestyle", "Non-Fiction"],
    tags: ["productivity", "technology", "minimalism"],
    lengthHours: 6,
    summary: "A philosophy for intentional technology use in a world of overwhelming digital clutter.",
    cover: "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?q=80&w=600&auto=format&fit=crop",
    rating: 4.5,
    reviews: [
      { user: "ProductivityHacker", rating: 5, comment: "Revolutionary approach to managing digital overwhelm." },
      { user: "TechWorker", rating: 4, comment: "Practical advice that actually works in the real world." }
    ]
  },
  {
    id: "b11",
    title: "The Hidden History of Women Scientists",
    author: "Dr. Maria Rodriguez",
    genres: ["History", "Science", "Non-Fiction"],
    tags: ["women", "science", "history"],
    lengthHours: 8,
    summary: "Uncovering the forgotten contributions of women to scientific discovery throughout history.",
    cover: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
    rating: 4.7,
    reviews: [
      { user: "ScienceTeacher", rating: 5, comment: "Eye-opening and inspiring. Should be required reading!" },
      { user: "HistoryStudent", rating: 5, comment: "Fascinating stories that were missing from my textbooks." }
    ]
  },
  {
    id: "b12",
    title: "Sustainable Living: A Practical Guide",
    author: "Green Earth Collective",
    genres: ["Environment", "Lifestyle", "Non-Fiction"],
    tags: ["sustainability", "environment", "practical"],
    lengthHours: 5,
    summary: "Simple, actionable steps to reduce your environmental footprint without sacrificing comfort.",
    cover: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=600&auto=format&fit=crop",
    rating: 4.4,
    reviews: [
      { user: "EcoWarrior", rating: 5, comment: "Finally, eco-friendly tips that are actually doable!" },
      { user: "FamilyLife", rating: 4, comment: "Great ideas for involving kids in sustainable practices." }
    ]
  },
  {
    id: "b13",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    genres: ["Finance", "Psychology", "Non-Fiction"],
    tags: ["money", "psychology", "investing"],
    lengthHours: 7,
    summary: "Timeless lessons on wealth, greed, and happiness from the intersection of psychology and finance.",
    cover: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=600&auto=format&fit=crop",
    rating: 4.9,
    reviews: [
      { user: "FinanceGuru", rating: 5, comment: "Best financial book I've ever read. Changed my perspective completely." },
      { user: "YoungProfessional", rating: 5, comment: "Wish I had read this in college. Essential financial wisdom." }
    ]
  },
  {
    id: "b14",
    title: "Cooking With Science",
    author: "Chef Marco Thompson",
    genres: ["Cooking", "Science", "Non-Fiction"],
    tags: ["cooking", "science", "recipes"],
    lengthHours: 6,
    summary: "Understanding the science behind cooking techniques to become a better home chef.",
    cover: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=600&auto=format&fit=crop",
    rating: 4.6,
    reviews: [
      { user: "HomeCook", rating: 5, comment: "Finally understand why my recipes work (or don't)!" },
      { user: "CulinaryStudent", rating: 4, comment: "Great blend of science and practical cooking advice." }
    ]
  },
  {
    id: "b15",
    title: "The Art of Public Speaking",
    author: "Jennifer Walsh",
    genres: ["Communication", "Self-Help", "Non-Fiction"],
    tags: ["speaking", "communication", "confidence"],
    lengthHours: 5,
    summary: "Overcome fear and master the art of compelling public speaking and presentation.",
    cover: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=600&auto=format&fit=crop",
    rating: 4.3,
    reviews: [
      { user: "BusinessPro", rating: 4, comment: "Practical techniques that helped me ace my presentations." },
      { user: "ShyPerson", rating: 5, comment: "Gave me the confidence to speak up in meetings!" }
    ]
  }
];
// Mock user base for collaborative filtering (tiny toy matrix)
// ratings[userId][bookId] = rating 1..5 (undefined = not rated)
const MOCK_USER_RATINGS = {
  u1: { b1: 5, b3: 4, b7: 5 },
  u2: { b2: 4, b4: 5, b6: 4 },
  u3: { b1: 4, b2: 5, b8: 4 },
  u4: { b5: 5, b3: 4, b2: 3 },
};

// -----------------------------
// User Data Management System
// -----------------------------

// User-specific data keys
const USER_KEYS = {
  preferences: (userId) => `vibesphere_${userId}_preferences`,
  library: (userId) => `vibesphere_${userId}_library`,
  ratings: (userId) => `vibesphere_${userId}_ratings`,
  favorites: (userId) => `vibesphere_${userId}_favorites`,
  history: (userId) => `vibesphere_${userId}_history`,
};

// User data manager
class UserDataManager {
  constructor(userId) {
    this.userId = userId;
  }

  // Get user-specific data
  getData(dataType, defaultValue = null) {
    if (!this.userId) return defaultValue;
    return loadLS(USER_KEYS[dataType](this.userId), defaultValue);
  }

  // Save user-specific data
  saveData(dataType, data) {
    if (!this.userId) return;
    saveLS(USER_KEYS[dataType](this.userId), data);
  }

  // Clear all user data (for logout)
  clearAllData() {
    if (!this.userId) return;
    Object.keys(USER_KEYS).forEach(dataType => {
      localStorage.removeItem(USER_KEYS[dataType](this.userId));
    });
  }

  // Initialize default user data
  initializeUserData() {
    if (!this.userId) return;
    
    // Initialize library if not exists
    if (!this.getData('library')) {
      this.saveData('library', []);
    }
    
    // Initialize ratings if not exists
    if (!this.getData('ratings')) {
      this.saveData('ratings', {});
    }
    
    // Initialize history if not exists
    if (!this.getData('history')) {
      this.saveData('history', []);
    }
    // Initialize favorites if not exists
    if (!this.getData('favorites')) {
      this.saveData('favorites', []);
    }
  }
}

// Utility to toggle favorite for current user
function toggleFavorite(userDataManager, book) {
  if (!userDataManager) return null;
  const fav = userDataManager.getData('favorites', []);
  const exists = fav.find((b) => b.id === book.id);
  let updated;
  if (exists) {
    updated = fav.filter((b) => b.id !== book.id);
  } else {
    updated = [{ id: book.id, title: book.title, authors: book.authors || book.author, cover: book.cover || (book.volumeInfo && book.volumeInfo.imageLinks && book.volumeInfo.imageLinks.thumbnail) }, ...fav];
  }
  userDataManager.saveData('favorites', updated);
  return updated;
}

// -----------------------------
// Utilities
// -----------------------------
const cls = (...args) => args.filter(Boolean).join(" ");

const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const loadLS = (k, def) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? def;
  } catch (e) {
    return def;
  }
};

// Tiny cosine similarity for collaborative filtering
function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0,
    na = 0,
    nb = 0;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// -----------------------------
// Hybrid Recommender (Content + Collaborative)
// -----------------------------
function useHybridRecommendations(user, userRatings, options = {}) {
  const { topN = 8, reasonFor = null } = options;

  return useMemo(() => {
    if (!user) return [];

    // Content profile: favoriteGenres + saved tags from library/search
    const favGenres = new Set(user.favoriteGenres || []);
    const historyTags = new Set((user.historyTags || []).slice(-10));

    // Build collaborative similarity against mock users
    const currentUserRatings = userRatings[user.id] || {};
    const sims = Object.entries(userRatings)
      .filter(([uid]) => uid !== user.id)
      .map(([uid, ratings]) => ({ uid, sim: cosineSim(currentUserRatings, ratings) }))
      .sort((a, b) => b.sim - a.sim);

    // Score each book
    const scored = BOOKS.map((b) => {
      // Skip already highly rated by current user (optional)
      const already = currentUserRatings[b.id];

      // Content score: genre overlap + tag hits + length preference
      let contentScore = 0;
      const genreHits = b.genres.reduce((acc, g) => acc + (favGenres.has(g) ? 1 : 0), 0);
      contentScore += genreHits * 2;
      const tagHits = b.tags.reduce((acc, t) => acc + (historyTags.has(t) ? 1 : 0), 0);
      contentScore += tagHits * 1.5;
      if (user.timeBudgetHours) {
        const diff = Math.abs(b.lengthHours - user.timeBudgetHours);
        contentScore += Math.max(0, 2 - diff * 0.3);
      }

      // Collaborative score: weighted sum of neighbors' ratings for this book
      let collabScore = 0;
      let simSum = 0;
      for (const { uid, sim } of sims.slice(0, 3)) {
        const rating = userRatings[uid]?.[b.id];
        if (rating) {
          collabScore += sim * rating;
          simSum += sim;
        }
      }
      if (simSum > 0) collabScore /= simSum; // normalize

      // Final score (weights adjustable)
      const finalScore = (contentScore || 0) * 0.6 + (collabScore || 0) * 0.4 + (already ? -2 : 0);

      // Reasons
      const reasons = [];
      if (genreHits > 0) reasons.push(`Matches your genres: ${b.genres.filter((g) => favGenres.has(g)).join(", ")}`);
      if (tagHits > 0) reasons.push(`Similar to tags you've explored: ${b.tags.filter((t) => historyTags.has(t)).join(", ")}`);
      if (simSum > 0) reasons.push("Similar readers loved this");
      if (user.timeBudgetHours) reasons.push(`~${b.lengthHours}h fits your time budget`);

      return { ...b, finalScore, reasons };
    })
      .filter((b) => !Number.isNaN(b.finalScore))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, topN);

    if (reasonFor) {
      const match = scored.find((x) => x.id === reasonFor);
      return match ? match.reasons : [];
    }

    return scored;
  }, [user, userRatings, topN, reasonFor]);
}

// -----------------------------
// Auth (mock)
// -----------------------------
function Auth({ onAuth }) {
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (tab === "signup" && !name) return alert("Please enter your name");
    if (!email || !password) return alert("Please enter email and password");

    const id = "u_" + email.split("@")[0].replace(/\W/g, ''); // Simple ID from email
    
    // Create user object
    const user = {
      id,
      name: name || email.split("@")[0],
      email,
      favoriteGenres: ["Mystery", "Romance"], // default; user can edit later
      historyTags: ["witty", "twist"],
      timeBudgetHours: 6,
    };
    
    // Initialize user-specific ratings if they don't exist
    const existingUserRatings = loadLS(`vibesphere_ratings_${user.id}`, null);
    if (!existingUserRatings) {
      saveLS(`vibesphere_ratings_${user.id}`, {});
    }
    
    onAuth(user);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-indigo-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-pink-400/30 to-rose-400/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>
      
      <div className="w-full max-w-md p-8 relative z-10">
        <div className="glass-card p-8 animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">📚</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                VibeSphere
              </h1>
            </div>
            <p className="text-slate-600 text-lg">Discover books that feel just right ✨</p>
          </div>
          
          <div className="flex gap-2 bg-slate-100/70 p-1.5 rounded-xl mb-8">
            <button
              className={cls(
                "flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                tab === "login" 
                  ? "bg-white shadow-md text-slate-800" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setTab("login")}
            >
              🔑 Login
            </button>
            <button
              className={cls(
                "flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                tab === "signup" 
                  ? "bg-white shadow-md text-slate-800" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setTab("signup")}
            >
              ✨ Sign up
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {tab === "signup" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">👤 Name</label>
                <input
                  className="input-modern"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">📧 Email</label>
              <input
                className="input-modern"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">🔒 Password</label>
              <input
                className="input-modern"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full btn-primary text-base py-3 mt-6"
            >
              {tab === "login" ? "🚀 Sign In" : "✨ Create Account"}
            </button>
          </form>
        </div>
      </div>
  </div>
  );
}

// -----------------------------
// Components
// -----------------------------
function TopNav({ user, onRoute, route, onLogout, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-20 glass-card border-b border-white/20 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-lg">📚</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">VibeSphere</span>
            <small className="text-[0.85rem] text-[var(--muted)] tagline">VibeSphere — where moods meet stories.</small>
          </div>
        </div>
  <nav className="ml-auto flex items-center gap-2">
          {[
            ["dashboard", "🏠 Home"],
            ["discover", "✨ Discover"],
            ["explore", "🔎 Explore"],
            ["favorites", "💖 Favorites"],
            ["library", "📚 Library"],
            ["profile", "👤 Profile"],
          ].map(([r, label]) => (
            <button
              key={r}
              className={cls(
                "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105",
                route === r 
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg" 
                  : "hover:bg-white/50 text-slate-700"
              )}
              onClick={() => onRoute(r)}
            >
              {label}
            </button>
          ))}
          <div className="flex items-center gap-3 ml-4">
            <div className="avatar text-sm">{user.name[0]}</div>

            {/* Animated theme switch */}
            <div
              role="switch"
              aria-checked={theme === 'night'}
              tabIndex={0}
              onClick={() => typeof onToggleTheme === 'function' && onToggleTheme()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); typeof onToggleTheme === 'function' && onToggleTheme(); } }}
              className="theme-switch hover-glow"
              title="Toggle theme"
            >
              <div className={`switch-track ${theme === 'night' ? 'night' : 'day'}`}>
                <div className={`switch-thumb ${theme === 'night' ? 'to-night' : 'to-day'}`} />
                <div className="switch-icons">
                  <span className="sun">☀️</span>
                  <span className="moon">🌙</span>
                </div>
              </div>
            </div>

            <button
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700 transition-all duration-200 hover:scale-105 shadow-md"
              onClick={onLogout}
            >
              🚪 Logout
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

// Sidebar removed — restoring original single-column layout

// Chat panel removed per request

function Hero({ user, onTimeBudget }) {
  const [hours, setHours] = useState(user.timeBudgetHours || 6);
  return (
    <>
      {/* Hero Image Section */}
      <section className="max-w-6xl mx-auto px-4 pt-6 pb-8">
        <div className="relative rounded-3xl overflow-hidden h-72 md:h-96 shadow-2xl">
          <div
            role="img"
            aria-label="Lavender café hero"
            className="w-full h-full hero-bg hero-figure-img"
          />
          <div className="absolute inset-0 hero-overlay flex items-center">
            <div className="px-6 md:px-12 text-[var(--title)] animate-slide-up max-w-3xl">
              <div className="mb-4">
                <small className="tagline text-sm text-[var(--muted)]">VibeSphere — where moods meet stories.</small>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                Discover Your Next
                <span className="block hero-title-highlight">
                  Great Read ✨
                </span>
              </h1>
              <p className="text-lg md:text-xl text-[var(--muted)] max-w-2xl leading-relaxed mb-6">
                Curated recommendations blended with reader tastes — a calm, cozy way to find books you'll love.
              </p>
              <div className="flex items-center gap-4">
                <button className="btn-primary shadow-lg">Explore Top Picks</button>
                <button className="btn-ghost">Browse Categories</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="max-w-6xl mx-auto px-4 pt-6 pb-8">
        <div className="modern-card p-8 bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/30">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4 greet-fade">
                <span className="greet-text">Hello, <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{user.name}</span>!</span>
                <span className="wave-emoji ml-3" role="img" aria-label="waving hand">👋</span>
              </h2>
              <div className="today-vibe mt-3" aria-live="polite">
                <span className="vibe-emoji" aria-hidden="true">☕</span>
                <span className="vibe-text">Your current mood: Calm Reader</span>
              </div>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                Our hybrid AI engine blends your tastes with similar readers — calm, clear, and perfectly personalized.
              </p>
              <div className="flex flex-wrap items-center gap-4 p-4 bg-white/70 rounded-2xl border border-white/50">
                <span className="text-sm font-medium text-slate-700">⏰ Reading time budget:</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={12}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 font-semibold text-sm shadow-sm">
                    ⏱️ ~{hours} hours
                  </span>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => onTimeBudget(hours)}
                  >
                    ✨ Update
                  </button>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-80 aspect-[4/3] rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-white/50 shadow-lg flex items-center justify-center p-6">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-bounce-gentle">🌿</div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Take a deep breath.<br/>
                  Let the books find you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function BookCard({ book, onAdd, onWhy }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  
  return (
    <article className="book-card group animate-fade-in" style={{width: '100%', height: '320px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>
      <div className="relative overflow-hidden flex-shrink-0" style={{height: '140px'}}>
        <CoverImage
          src={book.cover}
          title={book.title}
          author={book.author}
          className="book-cover img-contain group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        {book.rating && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
            <span>⭐</span>
            <span>{book.rating}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>
  <div className="p-4 flex-1 flex flex-col" style={{minHeight: 0}}>
        <h3 className="font-semibold text-slate-800 leading-tight line-clamp-2 mb-1">{book.title}</h3>
        <p className="text-sm text-indigo-600 font-medium mb-2">{book.author}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {book.genres.slice(0, 2).map((genre, i) => (
            <span key={i} className="text-xs bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
              {genre}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-600 line-clamp-3 mb-3 leading-relaxed">{book.summary}</p>
        
        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary flex-1 text-sm"
              onClick={() => onAdd(book)}
            >
              📚 Add to Library
            </button>
            <button
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors duration-200"
              onClick={() => setShowWhy((s) => !s)}
            >
              💡
            </button>
          </div>
          
          {book.reviews && book.reviews.length > 0 && (
            <button
              className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 text-sm font-medium transition-all duration-200"
              onClick={() => setShowReviews((s) => !s)}
            >
              {showReviews ? '👁️ Hide Reviews' : `💬 Reviews (${book.reviews.length})`}
            </button>
          )}
        </div>
        
        {showWhy && (
          <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-l-4 border-amber-400">
            <ul className="text-xs text-slate-700 space-y-1">
              {book.reasons?.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">✨</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {showReviews && book.reviews && (
          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-2">
            {book.reviews.map((review, i) => (
              <div key={i} className="bg-gradient-to-r from-slate-50 to-slate-100 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="avatar text-xs">{review.user[0]}</div>
                    <span className="font-medium text-slate-700 text-sm">{review.user}</span>
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, starI) => (
                      <span key={starI} className={`text-sm ${starI < review.rating ? 'text-amber-400' : 'text-slate-300'}`}>
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Carousel({ children }) {
  const ref = useRef(null);
  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2"
      >
        {children}
      </div>
    </div>
  );
}

function Dashboard({ user, setUser, ratings, setRatings, userDataManager }) {
  const [topPicks, setTopPicks] = useState([]);
  const [personalized, setPersonalized] = useState({});
  const [favoritesList, setFavoritesList] = useState([]);

  // Helper to record book to history
  const recordHistory = (item) => {
    try {
      const info = item.volumeInfo || {};
      const title = info.title || 'Untitled';
      const authors = (info.authors || []).join(', ');
      const thumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;
      
      const entry = {
        id: item.id,
        title,
        authors,
        cover: thumb ? thumb.replace(/^http:/, 'https:') : undefined,
        infoLink: info.infoLink
      };
      
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

  // load favorites when userDataManager changes
  useEffect(() => {
    if (userDataManager) {
      const fav = userDataManager.getData('favorites', []);
      setFavoritesList(fav || []);
    } else {
      setFavoritesList([]);
    }
  }, [userDataManager, user]);

  function handleToggleFavorite(book) {
    if (!userDataManager) return;
    const updated = toggleFavorite(userDataManager, book);
    setFavoritesList(updated || []);
  }

  // Fetch Top Picks and personalized rows from Google Books when user changes
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const tops = await fetchBooks('bestsellers', 12);
        if (!mounted) return;
        setTopPicks(tops || []);

        const genres = (user?.favoriteGenres || []).slice(0, 4);
        const tags = (user?.historyTags || []).slice(0, 6);
        const per = {};

        await Promise.all(
          genres.map(async (g) => {
            const items = await fetchBooks(`subject:${g}`, 10);
            if (!mounted) return;
            per[g] = items || [];
          })
        );

        if (tags.length && mounted) {
          const tagQ = tags.join(' OR ');
          const tagItems = await fetchBooks(tagQ, 12);
          per['Because you explored'] = tagItems || [];
        }

        // If no personalized items were fetched from Google (rate limits, no matches),
        // fall back to local BOOKS filtered by the user's favorite genres so the
        // Home page still feels personalized.
        if (mounted) {
          if (Object.keys(per).length === 0 && genres.length > 0) {
            // build local per-genre rows
            const localPer = {};
            for (const g of genres) {
              const items = BOOKS.filter((b) => (b.genres || []).includes(g)).slice(0, 10);
              if (items.length) localPer[g] = items;
            }
            // If we still have nothing, leave per as empty; otherwise use localPer
            setPersonalized(Object.keys(localPer).length ? localPer : per);
          } else {
            setPersonalized(per);
          }
        }
      } catch (e) {
        console.error('Failed loading Google categories', e);
      }
    }
    load();
    return () => { mounted = false };
  }, [user]);

  

  function addToLibrary(book) {
    if (!userDataManager) return;
    
    const library = userDataManager.getData('library', []);
    if (!library.find((x) => x.id === book.id)) {
      library.push({ ...book, progress: 0 });
      userDataManager.saveData('library', library);
    }
    
    // Record tag history for content-based personalization
    const updatedUser = {
      ...user,
      historyTags: Array.from(new Set([...(user.historyTags || []), ...book.tags])).slice(-15),
    };
    setUser(updatedUser);
    saveLS("vibesphere_user", updatedUser);
  }

  return (
    <main className="pb-16">
      <Hero
        user={user}
        onTimeBudget={(h) => {
          const u = { ...user, timeBudgetHours: h };
          setUser(u);
          saveLS("vibesphere_user", u);
        }}
      />

      <section className="max-w-6xl mx-auto px-4 space-y-8">
        
        {/* Recently Viewed Section */}
        <RecentlyViewed userDataManager={userDataManager} />
        
        {/* Top Picks (Google Books) */}
        <div className="modern-card p-6 bg-pink-50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-pink-700 mb-1">� Top Picks</h3>
              <p className="text-sm text-pink-600">Popular picks from Google Books</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-medium">Trending</div>
          </div>
          <div className="overflow-x-auto -mx-3 py-2">
            <div className="flex gap-4 px-3">
                {topPicks.map((item) => {
                const info = item.volumeInfo || {};
                const title = info.title || 'Untitled';
                const authors = (info.authors || []).join(', ');
                const thumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;
                return (
                  <div key={item.id} className="w-56 flex-shrink-0">
                    <div className="book-tile">
                      <article className="book-card">
                      <div className="book-cover-wrap">
                            {thumb ? <CoverImage className="book-cover img-contain" src={thumb.replace(/^http:/,'https:')} title={title} author={authors} alt={`${title} cover`} /> : <div className="skeleton book-cover" />}
                      </div>
                      <div className="book-info">
                        <h4 className="book-title">{title}</h4>
                        <p className="book-authors">{authors}</p>
                        <div className="mt-auto flex items-center gap-2">
                          <a className="view-link" href={info.infoLink} target="_blank" rel="noopener noreferrer" onClick={() => recordHistory(item)}>View</a>
                          {userDataManager && (
                            <button className="px-2 py-1 text-pink-600" onClick={() => {
                              const updated = toggleFavorite(userDataManager, { id: item.id, title, authors, cover: thumb });
                              // no setState here (UserDataManager persists), but you could set local state if needed
                            }}>{(userDataManager.getData('favorites', []).find(b=>b.id===item.id) ? '💖' : '🤍')}</button>
                          )}
                        </div>
                      </div>
                      </article>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

            {/* Favorites (per-user) */}
            {favoritesList && favoritesList.length > 0 && (
              <div className="modern-card p-6 bg-pink-50">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-pink-700 mb-1">💖 Your Favorites</h3>
                    <p className="text-sm text-pink-600">Books you saved</p>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-3 py-2">
                  <div className="flex gap-4 px-3">
                    {favoritesList.map((b) => (
                      <div key={b.id} className="w-56 flex-shrink-0">
                        <div className="book-tile">
                          <article className="book-card">
                          <div className="book-cover-wrap">
                            {b.cover ? <CoverImage className="book-cover img-contain" src={b.cover.replace(/^http:/,'https:')} title={b.title} author={b.authors || b.author} alt={`${b.title} cover`} /> : <div className="skeleton book-cover" />}
                          </div>
                          <div className="book-info">
                            <h4 className="book-title">{b.title}</h4>
                            <p className="book-authors">{b.authors}</p>
                            <div className="mt-auto flex items-center gap-2">
                              <a className="view-link" href={`https://www.google.com/search?q=${encodeURIComponent(b.title)}`} target="_blank" rel="noopener noreferrer">View</a>
                              <button className="px-2 py-1 text-pink-600" onClick={() => handleToggleFavorite(b)}>💔</button>
                            </div>
                          </div>
                          </article>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Personalized rows from Google based on user preferences */}
        {Object.entries(personalized).map(([label, items]) => (
          <div key={label} className="modern-card p-6 bg-pink-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-pink-700 mb-1">{label}</h3>
                <p className="text-sm text-pink-600">Recommendations based on your preferences</p>
              </div>
            </div>
            <div className="overflow-x-auto -mx-3 py-2">
              <div className="flex gap-4 px-3">
                  {items.map((item) => {
                  const info = item.volumeInfo || {};
                  const title = info.title || 'Untitled';
                  const authors = (info.authors || []).join(', ');
                  const thumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;
                  return (
                    <div key={item.id} className="w-56 flex-shrink-0">
                      <div className="book-tile">
                        <article className="book-card">
                        <div className="book-cover-wrap">
                          {thumb ? <CoverImage className="book-cover img-contain" src={thumb.replace(/^http:/,'https:')} title={title} author={authors} alt={`${title} cover`} /> : <div className="skeleton book-cover" />}
                        </div>
                        <div className="book-info">
                          <h4 className="book-title">{title}</h4>
                          <p className="book-authors">{authors}</p>
                          <div className="mt-auto flex items-center gap-2"><a className="view-link" href={info.infoLink} target="_blank" rel="noopener noreferrer" onClick={() => recordHistory(item)}>View</a>
                          {userDataManager && (
                            <button className="px-2 py-1 text-pink-600" onClick={() => toggleFavorite(userDataManager, { id: item.id, title, authors, cover: thumb })}>{(userDataManager.getData('favorites', []).find(b=>b.id===item.id) ? '💖' : '🤍')}</button>
                          )}</div>
                        </div>
                        </article>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Local Curated Collections */}
        <div className="modern-card p-6 bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-purple-700 mb-1">📚 Curated for You</h3>
              <p className="text-sm text-purple-600">Handpicked selections from our collection</p>
            </div>
          </div>
          <div className="overflow-x-auto -mx-3 py-2">
            <div className="flex gap-4 px-3">
              {BOOKS.slice(0, 12).map((book) => (
                <div key={book.id} className="w-56 flex-shrink-0">
                  <div className="book-tile">
                    <article className="book-card">
                      <div className="book-cover-wrap">
                        <CoverImage 
                          className="book-cover img-contain" 
                          src={book.cover} 
                          title={book.title} 
                          author={book.author} 
                          alt={`${book.title} cover`} 
                        />
                      </div>
                      <div className="book-info">
                        <h4 className="book-title">{book.title}</h4>
                        <p className="book-authors">{book.author}</p>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{book.summary}</p>
                        <div className="mt-auto flex items-center gap-2">
                          <button
                            className="view-link"
                            onClick={() => {
                              recordHistory({
                                id: book.id,
                                volumeInfo: {
                                  title: book.title,
                                  authors: [book.author],
                                  imageLinks: { thumbnail: book.cover },
                                  infoLink: `https://www.google.com/search?q=${encodeURIComponent(book.title + ' ' + book.author)}`
                                }
                              });
                              addToLibrary(book);
                            }}
                          >
                            Add to Library
                          </button>
                          {userDataManager && (
                            <button 
                              className="px-2 py-1 text-pink-600" 
                              onClick={() => toggleFavorite(userDataManager, { 
                                id: book.id, 
                                title: book.title, 
                                authors: book.author, 
                                cover: book.cover 
                              })}
                            >
                              {(userDataManager.getData('favorites', []).find(b=>b.id===book.id) ? '💖' : '🤍')}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Library({ user, ratings, setRatings, userDataManager }) {
  const [lib, setLib] = useState([]);

  // Load user-specific library when component mounts or user changes
  useEffect(() => {
    if (userDataManager) {
      const userLibrary = userDataManager.getData('library', []);
      setLib(userLibrary);
    } else {
      setLib([]);
    }
  }, [userDataManager, user]);

  function updateProgress(id, p) {
    if (!userDataManager) return;
    
    const updated = lib.map((b) => (b.id === id ? { ...b, progress: p } : b));
    setLib(updated);
    userDataManager.saveData('library', updated);
  }

  function handleRating(bookId, rating) {
    const newRatings = {
      ...ratings,
      [user.id]: {
        ...(ratings[user.id] || {}),
        [bookId]: rating,
      },
    };
    setRatings(newRatings);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="modern-card p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">📚 My Library</h2>
            <p className="text-slate-600">Your personal collection of books</p>
          </div>
          <div className="text-right">
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 font-semibold">
              {lib.length} {lib.length === 1 ? 'Book' : 'Books'}
            </div>
          </div>
        </div>
      </div>

      {lib.length === 0 ? (
        <div className="modern-card p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center shadow-lg">
              <span className="text-5xl animate-bounce-gentle">📚</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Your Library is Empty</h3>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Start building your personal collection by adding books from our AI-powered recommendations.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-full text-sm font-medium">
              <span>💡</span>
              <span>Browse the Home page to discover amazing books!</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid-responsive">
          {lib.map((b) => (
            <div key={b.id} className="modern-card overflow-hidden group">
              <div className="relative overflow-hidden">
                <img 
                  src={b.cover} 
                  alt={b.title} 
                  className="book-cover group-hover:scale-110 transition-transform duration-500" 
                  loading="lazy"
                />
                {b.rating && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <span>⭐</span>
                    <span>{b.rating}</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium leading-tight line-clamp-1">{b.title}</h3>
                <p className="text-xs text-slate-500 mb-1">{b.author}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {b.genres.slice(0, 2).map((genre, i) => (
                    <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {genre}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={b.progress || 0}
                    onChange={(e) => updateProgress(b.id, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs w-10 text-right font-medium">{b.progress || 0}%</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="text-lg hover:scale-110 transition-transform"
                      onClick={() => handleRating(b.id, star)}
                    >
                      {ratings[user.id]?.[b.id] >= star ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <div className="text-center mt-1">
                  <span className="text-xs text-slate-500">
                    {ratings[user.id]?.[b.id] ? `You rated: ${ratings[user.id][b.id]}/5` : "Tap to rate"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simple achievements */}
      <div className="mt-6 rounded-2xl border bg-white/80 p-4">
        <h4 className="font-semibold mb-2">Achievements</h4>
        <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>Starter Shelf — add your first book ✅</li>
          <li>Weekend Warrior — finish any book under 4 hours ⏳</li>
          <li>Mystery Maven — read 3 mystery titles 🕵️‍♀️</li>
        </ul>
      </div>
    </main>
  );
}

function Favorites({ userDataManager }) {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (!userDataManager) return setFavorites([]);
    const fav = userDataManager.getData('favorites', []);
    setFavorites(fav || []);
  }, [userDataManager]);

  function handleUnfavorite(book) {
    if (!userDataManager) return;
    const updated = toggleFavorite(userDataManager, book);
    setFavorites(updated || []);
  }

  function addToLibrary(book) {
    if (!userDataManager) return alert('Please sign in to save to library');
    const lib = userDataManager.getData('library', []);
    if (!lib.find((x) => x.id === book.id)) {
      lib.push({ ...book, progress: 0 });
      userDataManager.saveData('library', lib);
      alert('Added to your library');
    } else {
      alert('Already in your library');
    }
  }

  if (!favorites || favorites.length === 0) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="modern-card p-8 text-center">
          <div className="text-4xl mb-4">💖</div>
          <h3 className="text-2xl font-semibold mb-2">No favorites yet</h3>
          <p className="text-slate-600">Save books you love and they'll appear here for easy access.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="modern-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-pink-700">💖 Your Favorites</h2>
            <p className="text-sm text-pink-600">Quick access to books you saved</p>
          </div>
          <div className="text-sm text-slate-500">{favorites.length} {favorites.length === 1 ? 'book' : 'books'}</div>
        </div>
      </div>

      <div className="grid-responsive">
        {favorites.map((b) => (
          <div key={b.id} className="modern-card overflow-hidden group">
            <div className="relative overflow-hidden">
              {b.cover ? (
                <img src={b.cover} alt={b.title} className="book-cover group-hover:scale-110 transition-transform duration-500" />
              ) : (
                <div className="skeleton book-cover" />
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <h3 className="font-medium leading-tight line-clamp-2">{b.title}</h3>
              <p className="text-xs text-slate-500 mb-2">{b.authors || b.author}</p>
              <div className="mt-auto flex items-center gap-2">
                <a className="view-link" href={`https://www.google.com/search?q=${encodeURIComponent(b.title)}`} target="_blank" rel="noopener noreferrer">View</a>
                <button className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm" onClick={() => addToLibrary(b)}>📚 Add</button>
                <button className="px-3 py-1 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 text-sm" onClick={() => handleUnfavorite(b)}>💔 Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Profile({ user, setUser, userDataManager }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [genres, setGenres] = useState("");
  const [timeBudget, setTimeBudget] = useState(6);
  const [saved, setSaved] = useState(false);
  
  // Reset form when user changes
  useEffect(() => {
    setName(user.name || "");
    setEmail(user.email || "");
    setGenres(user.favoriteGenres?.join(", ") || "Mystery, Romance");
    setTimeBudget(user.timeBudgetHours || 6);
  }, [user]); // Reset when user changes

  function save() {
    if (!userDataManager) return;
    
    const fav = genres
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const updatedUser = {
      ...user,
      name: name || user.name,
      email: email || user.email,
      favoriteGenres: fav,
      timeBudgetHours: timeBudget,
    };

    // Update user state and save to user-specific storage
    setUser(updatedUser);
    try {
      userDataManager.saveData('preferences', updatedUser);
    } catch (e) {
      // ignore
    }
    saveLS("vibesphere_user", updatedUser);

    // Try to persist to backend if available (non-blocking)
    (async () => {
      try {
        await apiService.updateUserProfile({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, favoriteGenres: updatedUser.favoriteGenres, timeBudgetHours: updatedUser.timeBudgetHours });
      } catch (err) {
        // Backend update failed — we already persisted locally, so continue silently
        console.warn('Failed to update profile on server, saved locally instead', err);
      }
    })();

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Available genres for suggestions
  const availableGenres = [
    "Fiction", "Non-Fiction", "Romance", "Mystery", "Science Fiction", "Fantasy", 
    "Thriller", "Historical", "Biography", "Self-Help", "Psychology", "Adventure",
    "Drama", "Comedy", "Literary", "Young Adult", "Children", "Poetry",
    "Technology", "Science", "History", "Philosophy", "Travel", "Cooking"
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="rounded-2xl border bg-white/80 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Profile Settings</h2>
          {saved && (
            <span className="text-green-600 text-sm flex items-center gap-1">
              ✓ Preferences saved!
            </span>
          )}
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Your Information
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Name</label>
                  <input
                    className="w-full px-4 py-2 rounded-xl border bg-slate-50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Email</label>
                  <input
                    className="w-full px-4 py-2 rounded-xl border bg-slate-50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reading Time Budget
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={timeBudget}
                  onChange={(e) => setTimeBudget(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm min-w-fit">
                  {timeBudget} hours
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                How much time do you typically have for reading?
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Favorite Genres
              </label>
              <textarea
                className="w-full px-4 py-2 rounded-xl border h-20 resize-none"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="e.g., Mystery, Romance, Science Fiction"
              />
              <p className="text-xs text-slate-500 mt-1">
                Separate multiple genres with commas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Popular Genres
              </label>
              <div className="flex flex-wrap gap-2">
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    className={cls(
                      "px-3 py-1 rounded-full text-xs border transition-colors",
                      genres.toLowerCase().includes(genre.toLowerCase())
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                    onClick={() => {
                      const currentGenres = genres.split(",").map(g => g.trim()).filter(Boolean);
                      if (currentGenres.some(g => g.toLowerCase() === genre.toLowerCase())) {
                        // Remove genre
                        const filtered = currentGenres.filter(g => g.toLowerCase() !== genre.toLowerCase());
                        setGenres(filtered.join(", "));
                      } else {
                        // Add genre
                        setGenres([...currentGenres, genre].join(", "));
                      }
                    }}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <button 
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors" 
            onClick={save}
          >
            Save Preferences
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Your preferences help us recommend books that match your interests and reading habits.
          </p>
        </div>
      </div>
    </main>
  );
}

// -----------------------------
// App (Router + State)
// -----------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState("dashboard");
  const [theme, setTheme] = useState('morning');
  const [ratings, setRatings] = useState({ ...MOCK_USER_RATINGS });
  const [userDataManager, setUserDataManager] = useState(null);
  
  // Initialize user from localStorage on mount
  useEffect(() => {
    const savedUser = loadLS("vibesphere_user", null);
    if (savedUser) {
      handleUserLogin(savedUser);
    }
    // load theme preference
    const savedTheme = loadLS('vibesphere_theme', 'morning');
    setTheme(savedTheme || 'morning');
  }, []);
  
  // Function to properly load user and their data
  const handleUserLogin = (newUser) => {
    // Create user data manager
    const dataManager = new UserDataManager(newUser.id);
    
    // Load user-specific preferences
    const userPrefs = dataManager.getData('preferences', null);
    const fullUser = userPrefs || {
      ...newUser,
      favoriteGenres: ["Mystery", "Romance"],
      historyTags: ["witty", "twist"],
      timeBudgetHours: 6,
    };
    
    // Initialize user data if new user
    dataManager.initializeUserData();
    
    // Load user-specific ratings
    const userRatings = dataManager.getData('ratings', {});
    const allRatings = { ...MOCK_USER_RATINGS, [newUser.id]: userRatings };
    
    setUser(fullUser);
    setRatings(allRatings);
    setUserDataManager(dataManager);
    
    // Save current session
    saveLS("vibesphere_user", fullUser);
  };

  // Save ratings when they change
  useEffect(() => {
    if (user && userDataManager && ratings[user.id]) {
      userDataManager.saveData('ratings', ratings[user.id]);
    }
  }, [ratings, user, userDataManager]);

  function handleLogout() {
    // Clear current session completely
    localStorage.removeItem("vibesphere_user");
    setUser(null);
    setRatings({ ...MOCK_USER_RATINGS });
    setUserDataManager(null);
    setRoute("dashboard");
  }

  function toggleTheme() {
    const next = theme === 'morning' ? 'night' : 'morning';
    setTheme(next);
    saveLS('vibesphere_theme', next);
  }

  if (!user) return <Auth onAuth={handleUserLogin} />;

  return (
    <div className={(theme === 'night' ? 'theme-night ' : '') + "min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 relative overflow-hidden"}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-amber-400/10 to-orange-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      <div className="relative z-10">
        <TopNav user={user} route={route} onRoute={setRoute} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />

        <main>
          {route === "dashboard" && (
            <Dashboard 
              user={user} 
              setUser={setUser} 
              ratings={ratings} 
              setRatings={setRatings}
              userDataManager={userDataManager}
            />
          )}
          {route === "discover" && (
            <DiscoverPage userDataManager={userDataManager} />
          )}
          {route === "explore" && (
            <GoogleBooksGallery userDataManager={userDataManager} />
          )}
          {route === "favorites" && (
            <Favorites userDataManager={userDataManager} />
          )}
          {route === "library" && (
            <Library 
              user={user} 
              ratings={ratings} 
              setRatings={setRatings}
              userDataManager={userDataManager}
            />
          )}
          {route === "profile" && (
            <Profile 
              user={user} 
              setUser={setUser}
              userDataManager={userDataManager}
            />
          )}
        </main>

        <footer className="max-w-6xl mx-auto px-4 py-12 text-center relative z-10">
          <div className="modern-card p-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">📚</span>
              <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                VibeSphere
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Built with ❤️ for peaceful reading
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 rounded-full">
                🤖 AI-Powered
              </span>
              <span className="px-2 py-1 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 rounded-full">
                📖 Hybrid Filtering
              </span>
              <span className="px-2 py-1 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-full">
                🧘 No Mood Needed
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}