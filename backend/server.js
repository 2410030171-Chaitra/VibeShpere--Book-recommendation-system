require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/mongodb');
// ...existing imports...

// Import routes
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const recommendationsRoutes = require('./routes/recommendations');
const userRoutes = require('./routes/user');
const ratingsRoutes = require('./routes/ratings');
const libraryRoutes = require('./routes/library');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'VibeSphere API is running',
    timestamp: new Date().toISOString()
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
    // Connect to MongoDB
    await connectDB();
    
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