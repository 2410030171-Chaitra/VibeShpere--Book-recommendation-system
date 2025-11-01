const express = require('express');
const { pool } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, favorite_genres, history_tags, time_budget_hours, country FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      favoriteGenres: JSON.parse(user.favorite_genres || '[]'),
      historyTags: JSON.parse(user.history_tags || '[]'),
      timeBudgetHours: user.time_budget_hours || 6,
      country: user.country || ''
    };

    res.json(userData);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
  const { favoriteGenres, historyTags, timeBudgetHours, country } = req.body;

    await pool.execute(
      `UPDATE users 
       SET favorite_genres = ?, history_tags = ?, time_budget_hours = ?, country = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        JSON.stringify(favoriteGenres || []),
        JSON.stringify(historyTags || []),
        timeBudgetHours || 6,
        country || null,
        req.user.userId
      ]
    );

    // Fetch updated user data
    const [users] = await pool.execute(
      'SELECT id, name, email, favorite_genres, history_tags, time_budget_hours, country FROM users WHERE id = ?',
      [req.user.userId]
    );

    const user = users[0];
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      favoriteGenres: JSON.parse(user.favorite_genres || '[]'),
      historyTags: JSON.parse(user.history_tags || '[]'),
      timeBudgetHours: user.time_budget_hours || 6,
      country: user.country || ''
    };

    res.json({
      message: 'Profile updated successfully',
      user: userData
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;