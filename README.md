# CalmReads - Book Recommendation Website

A serene, modern book recommendation website built with React and TailwindCSS. Features hybrid filtering (content + collaborative) for personalized book recommendations.

## Features

- **Hybrid Recommendation Engine**: Combines content-based and collaborative filtering
- **User Authentication**: Mock authentication system with localStorage
- **Personal Library**: Add books, track reading progress, and rate books
- **Search**: Find books by title, author, or genre
- **User Profiles**: Customize favorite genres and preferences
- **Responsive Design**: Beautiful, modern UI with TailwindCSS

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Project Structure

- `App.jsx` - Main application component with all functionality
- `src/main.jsx` - React app entry point
- `src/index.css` - Global styles and Tailwind imports
- `tailwind.config.js` - Tailwind CSS configuration
- `vite.config.js` - Vite build tool configuration

## Key Features Explained

### Hybrid Recommendation System
The app uses a combination of:
- **Content-based filtering**: Matches books based on genres, tags, and reading time preferences
- **Collaborative filtering**: Uses cosine similarity to find similar users and recommend books they liked

### Mock Data
The app includes:
- 8 sample books with covers, summaries, and metadata
- Mock user ratings for collaborative filtering
- All data is stored in localStorage for persistence

### User Features
- Create account or login
- Set reading time budget and favorite genres
- Search and browse books
- Add books to personal library
- Track reading progress with slider
- Rate books with star ratings
- View personalized recommendations

## Customization

To use in a real project:
1. Replace mock authentication with Firebase/Auth0
2. Connect to a real book database/API
3. Implement server-side collaborative filtering
4. Add more sophisticated recommendation algorithms
5. Include user reviews and social features

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **localStorage** - Client-side data persistence

## License

This project is open source and available under the MIT License.