const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get favorites for a user: GET /api/favorites/:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT b.* FROM favorites f JOIN books b ON f.book_id = b.id WHERE f.user_id = ? ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[favorites:get] Error', err && err.message);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add a favorite: POST /api/favorites
// body: { user_id, book_id }
router.post('/', async (req, res) => {
  const { user_id, book_id } = req.body;
  if (!user_id || !book_id) return res.status(400).json({ error: 'user_id and book_id required' });
  try {
    const [result] = await pool.query(
      `INSERT INTO favorites (user_id, book_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [user_id, book_id]
    );
    res.json({ success: true, insertedId: result.insertId });
  } catch (err) {
    console.error('[favorites:post] Error', err && err.message);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove a favorite: DELETE /api/favorites
// body: { user_id, book_id }
router.delete('/', async (req, res) => {
  const { user_id, book_id } = req.body;
  if (!user_id || !book_id) return res.status(400).json({ error: 'user_id and book_id required' });
  try {
    const [result] = await pool.query(
      `DELETE FROM favorites WHERE user_id = ? AND book_id = ?`,
      [user_id, book_id]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('[favorites:delete] Error', err && err.message);
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

module.exports = router;
