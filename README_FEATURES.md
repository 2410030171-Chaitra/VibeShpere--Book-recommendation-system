# 📚 VibeSphere - AI-Powered Book Recommendation Website

A beautiful, modern book recommendation platform with AI-powered mood-based suggestions, Firebase Google Authentication, and real-time book discovery powered by Google Books API.

## ✨ Features

### Frontend
- **🎨 Modern UI/UX** - Beautiful, responsive design similar to Spotify/Goodreads
- **🌙 Dark/Light Mode** - Seamless theme switching with smooth transitions
- **🔐 Google Authentication** - One-click sign-in with Firebase Google OAuth
- **😊 Mood-Based Discovery** - AI recommendations based on your current mood
  - Happy, Romantic, Adventurous, Mysterious, Inspiring, Reflective, Calm, Dark, Fantastical, Thoughtful
- **📖 Genre Filters** - Filter by Fiction, Mystery, Romance, Fantasy, Sci-Fi, and more
- **🔥 Trending Books** - Real-time popular and bestselling books
- **🔍 Smart Search** - Search by title, author, or keywords with instant results
- **💖 Favorites System** - Save and track your favorite books
- **📚 Personal Library** - Build your reading collection
- **⚡ Loading Skeletons** - Beautiful shimmer effects during data fetching
- **🖼️ Smart Cover Images** - Always displays valid book covers with fallbacks

### Backend
- **🚀 Node.js + Express** - Fast, scalable API server
- **🧠 AI Recommendations** - Intelligent book suggestions based on mood and genre
- **💾 Smart Caching** - 30-minute in-memory cache for faster responses
- **📡 Google Books Integration** - Access to millions of books with covers
- **🔒 MongoDB Integration** - User data persistence
- **🎯 Optimized Queries** - Filters and paging for better performance

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB (local or Atlas)
- Firebase project (for Google Auth)

### Installation

1. **Clone the repository**
```bash
cd "/Users/devarshettypravalika/Desktop/fedf project"
```

2. **Install frontend dependencies**
```bash
npm install
```

3. **Install backend dependencies**
```bash
cd backend
npm install
cd ..
```

4. **Set up Firebase Authentication**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project (or select existing)
   - Enable Google Authentication in Authentication > Sign-in method
   - Go to Project Settings > General
   - Add a Web app and copy the config

5. **Create .env file in project root**
```bash
cp .env.example .env
```

Then edit `.env` and add your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_URL=http://localhost:5000/api
```

6. **Set up MongoDB**
   - Create a MongoDB database (local or Atlas)
   - Update `backend/.env` with your MongoDB connection string

7. **Start the backend server**
```bash
cd backend
npm start
```
Backend will run on http://localhost:5000

8. **Start the frontend (in a new terminal)**
```bash
npm run dev
```
Frontend will run on http://localhost:5173

9. **Open your browser**
```
http://localhost:5173
```

## 📂 Project Structure

```
fedf project/
├── src/
│   ├── components/
│   │   ├── MoodSelector.jsx          # Mood selection UI
│   │   ├── DiscoverPage.jsx          # AI-powered discovery page
│   │   ├── GoogleSignInButton.jsx    # Google auth button
│   │   ├── GoogleBooksGallery.jsx    # Search & browse books
│   │   └── ErrorBoundary.jsx         # Error handling
│   ├── services/
│   │   ├── recommendations.js        # Recommendations API client
│   │   ├── firebaseAuth.js           # Firebase authentication
│   │   ├── googleBooks.js            # Google Books API
│   │   └── api.js                    # Backend API client
│   ├── index.css                     # Global styles & themes
│   └── main.jsx                      # React entry point
├── backend/
│   ├── routes/
│   │   ├── recommendations.js        # AI recommendations endpoint
│   │   ├── auth.js                   # User authentication
│   │   ├── books.js                  # Book management
│   │   └── ...
│   ├── config/
│   │   ├── mongodb.js               # MongoDB connection
│   │   └── database.js              # MySQL connection
│   └── server.js                    # Express server
├── App.jsx                          # Main React component
├── package.json                     # Frontend dependencies
└── .env.example                     # Environment template
```

## 🎯 API Endpoints

### Recommendations API

**Get Mood-Based Recommendations**
```
GET /api/recommendations/discover?mood=happy&genre=fiction&limit=40
```

**Get Trending Books**
```
GET /api/recommendations/trending?limit=20
```

**Search Books**
```
GET /api/recommendations/search?q=harry+potter&limit=60
```

**Get Books by Author**
```
GET /api/recommendations/author/J.K.+Rowling?limit=20
```

**Get Book Details**
```
GET /api/recommendations/book/:volumeId
```

**Clear Cache** (Development only)
```
POST /api/recommendations/cache/clear
```

## 🎨 Features in Detail

### 1. Mood-Based Recommendations
The AI analyzes your selected mood and suggests books that match your emotional state:
- **Happy** → Uplifting, feel-good stories
- **Romantic** → Love stories and romance novels
- **Adventurous** → Action-packed adventures
- **Mysterious** → Detective stories and suspense
- **Inspiring** → Motivational and biographical works
- **Reflective** → Emotional, moving narratives
- **Calm** → Peaceful, cozy reads
- **Dark** → Thrillers and psychological fiction
- **Fantastical** → Fantasy and sci-fi worlds
- **Thoughtful** → Literary and philosophical works

### 2. Smart Caching
- 30-minute in-memory cache reduces API calls
- Faster subsequent searches
- Reduced Google Books API quota usage

### 3. Cover Image Handling
- Always shows valid book covers
- Fallback to Open Library for better quality
- SVG placeholder for books without covers
- HTTPS enforcement and zoom enhancement

### 4. User Experience
- Shimmer loading skeletons
- Smooth animations and transitions
- Responsive design (mobile, tablet, desktop)
- Keyboard navigation support
- Dark/light mode with persistent preference

## 🔧 Configuration

### Frontend Environment Variables
```env
VITE_FIREBASE_API_KEY=           # Firebase API key
VITE_FIREBASE_AUTH_DOMAIN=       # Firebase auth domain
VITE_FIREBASE_PROJECT_ID=        # Firebase project ID
VITE_FIREBASE_STORAGE_BUCKET=    # Firebase storage bucket
VITE_FIREBASE_MESSAGING_SENDER_ID= # Firebase messaging sender ID
VITE_FIREBASE_APP_ID=            # Firebase app ID
VITE_API_URL=                    # Backend API URL
```

### Backend Environment Variables (backend/.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/vibesphere
NODE_ENV=development
```

## 🎓 Usage Examples

### Searching for Books by Mood
1. Navigate to the **✨ Discover** tab
2. Select your current mood (e.g., "Happy")
3. Optionally filter by genre (e.g., "Fiction")
4. Browse AI-curated recommendations

### Adding Books to Favorites
1. Click the heart icon (🤍) on any book card
2. It turns pink (💖) when favorited
3. View all favorites in the **💖 Favorites** tab

### Using Google Sign-In
1. Click "Sign in with Google" on the login page
2. Choose your Google account
3. Instant access to personalized features

## 🛠️ Development

### Adding New Moods
Edit `src/components/MoodSelector.jsx` and `backend/routes/recommendations.js`:

```javascript
// Add to MOODS array in MoodSelector.jsx
{
  id: 'excited',
  label: 'Excited',
  emoji: '🎉',
  color: 'from-yellow-400 to-red-400',
  description: 'High-energy page-turners'
}

// Add to MOOD_TO_QUERY_MAP in recommendations.js
excited: ['page-turners', 'fast-paced', 'action-packed']
```

### Customizing Themes
Edit `src/index.css`:
```css
:root {
  --card: #ffffff;
  --title: #1e293b;
  --muted: #64748b;
}

[data-theme="night"] {
  --card: #1e293b;
  --title: #e2e8f0;
  --muted: #94a3b8;
}
```

## 🐛 Troubleshooting

### Firebase Authentication Issues
- Ensure you've enabled Google sign-in in Firebase Console
- Check that your domain is authorized in Firebase settings
- Verify all environment variables are correct

### No Books Appearing
- Check backend server is running (`npm start` in backend/)
- Verify API endpoint in browser: http://localhost:5000/api/recommendations/trending
- Check browser console for errors
- Clear cache: POST to `/api/recommendations/cache/clear`

### CORS Errors
- Ensure backend CORS is configured for your frontend URL
- Check `backend/server.js` has `app.use(cors())`

## 📝 License

This project is part of a portfolio demonstration.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📧 Support

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ using React, Node.js, Firebase, and Google Books API**
