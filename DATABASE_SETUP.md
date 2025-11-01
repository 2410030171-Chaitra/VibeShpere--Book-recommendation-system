# VibeSphere with SQL Database Integration

Your VibeSphere application now includes a complete backend API with SQL database integration! Here's everything you need to know:

## 🏗️ Architecture Overview

```
VibeSphere Project/
├── frontend/               # React app (Vite + TailwindCSS)
│   ├── src/
│   ├── App.jsx
│   └── services/api.js     # API communication layer
└── backend/                # Node.js + Express API
    ├── config/             # Database configuration
    ├── routes/             # API endpoints
    ├── middleware/         # Authentication middleware
    ├── database/           # SQL schema
    └── server.js           # Main server file
```

## 🚀 Quick Start Guide

### 1. Install Backend Dependencies
```bash
# From the main project directory
npm run install:backend
```

### 2. Set Up Your SQL Database

#### For MySQL:
1. Install MySQL on your system
2. Create a database:
   ```sql
   CREATE DATABASE calmreads_db;
   ```
3. Import the schema:
   ```bash
   mysql -u your_username -p calmreads_db < backend/database/schema.sql
   ```

#### For PostgreSQL:
1. Install PostgreSQL
2. Create database and modify the backend to use `pg` instead of `mysql2`

#### For SQLite:
1. Modify backend to use `sqlite3` package
2. Update connection configuration

### 3. Configure Environment
```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=calmreads_db
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key
PORT=5000
```

### 4. Start the Application

#### Option A: Run both frontend and backend together
```bash
npm run dev:full
```

#### Option B: Run separately
```bash
# Terminal 1 - Backend
npm run backend

# Terminal 2 - Frontend  
npm run dev
```

## 📊 Database Schema

Your database includes these tables:

### Users Table
- User accounts, preferences, favorite genres
- Password hashing with bcrypt
- JWT authentication

### Books Table
- Book information, genres, tags, covers
- JSON fields for flexible metadata
- Rating aggregation

### User Ratings Table
- 1-5 star ratings from users
- Used for collaborative filtering
- Unique constraint per user-book pair

### User Library Table
- Personal reading lists
- Reading progress tracking (0-100%)
- Add/remove books functionality

### Book Reviews Table
- User reviews and comments
- Star ratings with text feedback
- Displayed in book cards

## 🔌 API Integration

The frontend now communicates with your SQL database through REST API endpoints:

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login

### Books
- `GET /api/books` - Fetch all books with reviews
- `GET /api/books/search/:query` - Search functionality

### User Management
- `GET /api/user/profile` - Get user preferences
- `PUT /api/user/profile` - Save preferences (now works!)

### Ratings & Library
- `POST /api/ratings` - Rate books
- `GET /api/library` - Personal library
- `POST /api/library/add` - Add books to library

## 🔄 Data Migration

Your existing localStorage data can be migrated to the database:

1. Export current localStorage data
2. Create user account via API
3. Import books, ratings, and library items
4. Update frontend to use API instead of localStorage

## 🛠️ Customization Options

### Adding New Book Fields
1. Update database schema
2. Modify API endpoints
3. Update frontend components

### Different SQL Databases
- **MySQL**: Current setup (recommended)
- **PostgreSQL**: Replace `mysql2` with `pg`
- **SQLite**: Use `sqlite3` for local development
- **SQL Server**: Use `mssql` package

### Authentication Methods
- Current: JWT tokens
- Options: OAuth, Firebase Auth, Auth0
- Session-based authentication

## 🔐 Security Features

- Password hashing with bcrypt
- JWT token authentication
- SQL injection prevention
- CORS configuration
- Input validation

## 📱 Frontend Changes

The React app now includes:
- API service layer (`src/services/api.js`)
- Token-based authentication
- Real-time data sync with database
- Error handling for API calls

## 🚀 Production Deployment

### Backend Deployment
1. Use services like Heroku, Railway, or DigitalOcean
2. Set up environment variables
3. Configure database (MySQL, PostgreSQL)
4. Enable HTTPS

### Frontend Deployment
1. Update API_BASE_URL in api.js
2. Deploy to Vercel, Netlify, or similar
3. Configure CORS in backend

## 🐛 Troubleshooting

### Database Connection Issues
- Check credentials in `.env`
- Ensure database server is running
- Verify network connectivity

### API Errors
- Check backend logs
- Verify API endpoints
- Test with tools like Postman

### Authentication Problems
- Clear localStorage tokens
- Check JWT_SECRET configuration
- Verify token expiration

## 📈 Next Steps

1. **Set up your database** using the schema provided
2. **Configure the .env file** with your database credentials
3. **Start both servers** and test the integration
4. **Migrate existing data** if needed
5. **Deploy to production** when ready

Your CalmReads app now has a professional database backend that can scale with your needs!