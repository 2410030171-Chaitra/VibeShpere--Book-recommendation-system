const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// Get database statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    // Count users
    const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM users');
    stats.users = userCount[0].count;

    // Count books
    const [bookCount] = await pool.execute('SELECT COUNT(*) as count FROM books');
    stats.books = bookCount[0].count;

    // Count ratings
    const [ratingCount] = await pool.execute('SELECT COUNT(*) as count FROM user_ratings');
    stats.ratings = ratingCount[0].count;

    // Count library items
    const [libraryCount] = await pool.execute('SELECT COUNT(*) as count FROM user_library');
    stats.library = libraryCount[0].count;

    // Count reviews
    const [reviewCount] = await pool.execute('SELECT COUNT(*) as count FROM book_reviews');
    stats.reviews = reviewCount[0].count;

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all tables
router.get('/tables', async (req, res) => {
  try {
    const [tables] = await pool.execute('SHOW TABLES');
    res.json(tables);
  } catch (error) {
    console.error('Tables error:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Get table structure
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const [columns] = await pool.execute(`DESCRIBE ${tableName}`);
    const [data] = await pool.execute(`SELECT * FROM ${tableName} LIMIT 10`);
    
    res.json({
      structure: columns,
      sampleData: data
    });
  } catch (error) {
    console.error('Table info error:', error);
    res.status(500).json({ error: 'Failed to fetch table info' });
  }
});

// Execute custom query (be careful with this in production!)
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Only allow SELECT queries for safety
    if (!query.trim().toLowerCase().startsWith('select')) {
      return res.status(400).json({ error: 'Only SELECT queries are allowed' });
    }

    const [results] = await pool.execute(query);
    res.json(results);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Query execution failed: ' + error.message });
  }
});

// Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const activity = {};

    // Recent users
    const [recentUsers] = await pool.execute(`
      SELECT id, name, email, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    activity.recentUsers = recentUsers;

    // Recent ratings
    const [recentRatings] = await pool.execute(`
      SELECT 
        ur.rating, 
        ur.created_at,
        u.name as user_name,
        b.title as book_title
      FROM user_ratings ur
      JOIN users u ON ur.user_id = u.id
      JOIN books b ON ur.book_id = b.id
      ORDER BY ur.created_at DESC
      LIMIT 5
    `);
    activity.recentRatings = recentRatings;

    // Popular books (most rated)
    const [popularBooks] = await pool.execute(`
      SELECT 
        b.title,
        b.author,
        COUNT(ur.id) as rating_count,
        AVG(ur.rating) as avg_rating
      FROM books b
      LEFT JOIN user_ratings ur ON b.id = ur.book_id
      GROUP BY b.id, b.title, b.author
      ORDER BY rating_count DESC, avg_rating DESC
      LIMIT 5
    `);
    activity.popularBooks = popularBooks;

    res.json(activity);
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;