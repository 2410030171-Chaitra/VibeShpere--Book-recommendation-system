const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Optional MongoDB connection.
 *
 * Primary store for this project is MySQL. MongoDB is entirely optional and is
 * OFF by default. We will connect to Mongo ONLY when USE_MONGODB=true. The
 * presence of MONGODB_URI alone must NOT trigger a connection attempt to avoid
 * long startup delays/timeouts for users who don't run Mongo locally.
 */
const connectDB = async () => {
  const wantMongo = String(process.env.USE_MONGODB || '').toLowerCase() === 'true';
  if (!wantMongo) {
    console.log('ℹ️  Skipping MongoDB connection (using MySQL). Set USE_MONGODB=true to enable.');
    return;
  }

  const mongoURI = (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) || 'mongodb://localhost:27017/calmreads_db';

  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.warn('⚠️  MongoDB connection failed (continuing with MySQL):', error.message);
  }
};

// Handle connection errors (log-only)
mongoose.connection.on('error', (error) => {
  console.warn('MongoDB connection error (non-fatal):', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

module.exports = connectDB;