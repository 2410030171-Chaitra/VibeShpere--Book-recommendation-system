require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectMongoIfEnabled = require('./config/mongodb');
const { testConnection: testMySQLConnection, pool } = require('./config/database');
// ...existing imports...

// Import routes
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const recommendationsRoutes = require('./routes/recommendations');
const userRoutes = require('./routes/user');
const ratingsRoutes = require('./routes/ratings');
const libraryRoutes = require('./routes/library');
const adminRoutes = require('./routes/admin');
const favoritesRoutes = require('./routes/favorites');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Disable ETag to avoid 304 Not Modified responses that can confuse JSON clients
app.set('etag', false);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Ensure dynamic API responses are not cached by the browser/proxies
app.use((_, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Simple request/response logger to help debug timeouts
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[RES] ${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  // in case of client disconnect
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log(`[CLOSE] ${new Date().toISOString()} ${req.method} ${req.originalUrl} - client closed connection`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoritesRoutes);

// Health check endpoint (includes DB probe)
app.get('/api/health', async (req, res) => {
  async function checkDB() {
    try {
      const conn = await pool.getConnection();
      await conn.query('SELECT 1');
      conn.release();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  const dbStatus = await checkDB();
  res.status(200).json({
    status: 'OK',
    message: 'VibeSphere API is running',
    timestamp: new Date().toISOString(),
    db: dbStatus
  });
});

// ...image proxy removed; restoring original backend routes

// Error handling middleware
app.use((err, req, res, _next) => {
  void _next;
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Optional: try Mongo (non-fatal) and verify MySQL connectivity
    await connectMongoIfEnabled();
    await testMySQLConnection();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 VibeSphere API server running on http://localhost:${PORT}`);
      console.log(`🌍 Also accessible from network at http://0.0.0.0:${PORT}`);
      console.log(`📚 API endpoints available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();