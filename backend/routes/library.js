const express = require('express');
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get user's library
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [libraryItems] = await pool.execute(`
      SELECT 
        ul.book_id,
        ul.progress,
        ul.added_at,
        b.title,
        b.author,
        b.genres,
        b.tags,
        b.length_hours,
        b.summary,
        b.cover_url,
        b.rating
      FROM user_library ul
      JOIN books b ON ul.book_id = b.id
      WHERE ul.user_id = ?
      ORDER BY ul.added_at DESC
    `, [req.user.userId]);

    const library = libraryItems.map(item => ({
      id: item.book_id,
      title: item.title,
      author: item.author,
      genres: JSON.parse(item.genres),
      tags: JSON.parse(item.tags),
      lengthHours: item.length_hours,
      summary: item.summary,
      cover: item.cover_url,
      rating: item.rating,
      progress: item.progress,
      addedAt: item.added_at
    }));

    res.json(library);
  } catch (error) {
    console.error('Get library error:', error);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// Add book to library
router.post('/add', authMiddleware, async (req, res) => {
  try {
    const { bookId } = req.body;

    if (!bookId) {
      return res.status(400).json({ error: 'Book ID is required' });
    }

    // Check if book exists
    const [books] = await pool.execute('SELECT id FROM books WHERE id = ?', [bookId]);
    if (books.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Add to library (ignore if already exists)
    await pool.execute(
      `INSERT IGNORE INTO user_library (user_id, book_id, progress) 
       VALUES (?, ?, 0)`,
      [req.user.userId, bookId]
    );

    res.json({ message: 'Book added to library successfully' });
  } catch (error) {
    console.error('Add to library error:', error);
    res.status(500).json({ error: 'Failed to add book to library' });
  }
});

// Update reading progress
router.put('/progress', authMiddleware, async (req, res) => {
  try {
    const { bookId, progress } = req.body;

    if (!bookId || progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Invalid book ID or progress value' });
    }

    const [result] = await pool.execute(
      `UPDATE user_library 
       SET progress = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND book_id = ?`,
      [progress, req.user.userId, bookId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Book not found in library' });
    }

    res.json({ message: 'Progress updated successfully' });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Remove book from library
router.delete('/:bookId', authMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM user_library WHERE user_id = ? AND book_id = ?',
      [req.user.userId, bookId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Book not found in library' });
    }

    res.json({ message: 'Book removed from library successfully' });
  } catch (error) {
    console.error('Remove from library error:', error);
    res.status(500).json({ error: 'Failed to remove book from library' });
  }
});

module.exports = router;