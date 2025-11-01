const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    // Do not set default saved preferences for new users
    const { name, email, password, favoriteGenres = [] } = req.body;

    // Check if user already exists
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, favorite_genres, history_tags, time_budget_hours) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name, 
        email, 
        passwordHash, 
        JSON.stringify(favoriteGenres || []),
        JSON.stringify(['witty', 'twist']),
        6
      ]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    const user = {
      id: result.insertId,
      name,
      email,
      favoriteGenres,
      historyTags: ['witty', 'twist'],
      timeBudgetHours: 6
    };

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      favoriteGenres: JSON.parse(user.favorite_genres || '[]'),
      historyTags: JSON.parse(user.history_tags || '[]'),
      timeBudgetHours: user.time_budget_hours || 6
    };

    res.json({
      message: 'Login successful',
      user: userData,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;