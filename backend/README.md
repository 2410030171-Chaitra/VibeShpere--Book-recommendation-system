# VibeSphere Backend API

This is the backend API for the VibeSphere book recommendation system, built with Node.js, Express, and MySQL.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Database Setup

#### Option A: Using MySQL (Recommended)
1. Install MySQL on your system
2. Create a new database called `calmreads_db`
3. Run the schema file to create tables:
   ```bash
   mysql -u your_username -p calmreads_db < database/schema.sql
   ```

#### Option B: Using other SQL databases
- For PostgreSQL: Modify the schema.sql file and use `pg` instead of `mysql2`
- For SQLite: Use `sqlite3` package and modify the connection config

### 3. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your database credentials:
   ```env
   DB_HOST=localhost
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   DB_NAME=calmreads_db
   DB_PORT=3306
   
   JWT_SECRET=your_super_secret_jwt_key_here
   PORT=5000
   ```

### 4. Start the Server

#### Development mode (with auto-restart):
```bash
npm run dev
```

#### Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Books
- `GET /api/books` - Get all books with reviews
- `GET /api/books/:id` - Get specific book
- `GET /api/books/search/:query` - Search books

### User Profile
- `GET /api/user/profile` - Get user profile (requires auth)
- `PUT /api/user/profile` - Update user profile (requires auth)

### Ratings
- `GET /api/ratings` - Get user's ratings (requires auth)
- `POST /api/ratings` - Rate a book (requires auth)
- `GET /api/ratings/all` - Get all ratings (for collaborative filtering)

### Library
- `GET /api/library` - Get user's library (requires auth)
- `POST /api/library/add` - Add book to library (requires auth)
- `PUT /api/library/progress` - Update reading progress (requires auth)
- `DELETE /api/library/:bookId` - Remove book from library (requires auth)

### Health Check
- `GET /api/health` - Server health status

## Database Schema

The database includes the following tables:
- `users` - User accounts and preferences
- `books` - Book information and metadata
- `user_ratings` - User ratings for books
- `user_library` - User's personal library
- `book_reviews` - Book reviews and comments

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
```
Authorization: Bearer your_jwt_token_here
```

## Error Handling

All endpoints return JSON responses with appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Development

### Adding New Routes
1. Create route file in `routes/` directory
2. Import and use in `server.js`
3. Add authentication middleware where needed

### Database Migrations
When updating the database schema:
1. Update `database/schema.sql`
2. Create migration scripts if needed
3. Update API endpoints accordingly

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a process manager like PM2
3. Set up reverse proxy with Nginx
4. Use environment variables for sensitive data
5. Enable HTTPS
6. Set up database backups

## Troubleshooting

### Connection Issues
- Check database credentials in `.env`
- Ensure MySQL server is running
- Check firewall settings

### Authentication Problems
- Verify JWT_SECRET is set
- Check token expiration
- Ensure proper Authorization header format