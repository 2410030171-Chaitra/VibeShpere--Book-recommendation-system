const express = require('express');
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get user ratings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [ratings] = await pool.execute(
      'SELECT book_id, rating FROM user_ratings WHERE user_id = ?',
      [req.user.userId]
    );

    const ratingsMap = {};
    ratings.forEach(rating => {
      ratingsMap[rating.book_id] = rating.rating;
    });

    res.json(ratingsMap);
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Rate a book
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { bookId, rating } = req.body;

    if (!bookId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid book ID or rating' });
    }

    // Check if book exists
    const [books] = await pool.execute('SELECT id FROM books WHERE id = ?', [bookId]);
    if (books.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Insert or update rating
    await pool.execute(
      `INSERT INTO user_ratings (user_id, book_id, rating) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, bookId, rating]
    );

    res.json({ message: 'Rating saved successfully' });
  } catch (error) {
    console.error('Rate book error:', error);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// Get all ratings (for collaborative filtering)
router.get('/all', async (req, res) => {
  try {
    const [ratings] = await pool.execute(
      'SELECT user_id, book_id, rating FROM user_ratings'
    );

    const ratingsMap = {};
    ratings.forEach(rating => {
      if (!ratingsMap[`u${rating.user_id}`]) {
        ratingsMap[`u${rating.user_id}`] = {};
      }
      ratingsMap[`u${rating.user_id}`][rating.book_id] = rating.rating;
    });

    res.json(ratingsMap);
  } catch (error) {
    console.error('Get all ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

module.exports = router;