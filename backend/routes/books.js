const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// Get all books
router.get('/', async (req, res) => {
  try {
    const [books] = await pool.execute(`
      SELECT 
        b.*,
        COALESCE(AVG(br.rating), b.rating) as avg_rating,
        COUNT(br.id) as review_count
      FROM books b
      LEFT JOIN book_reviews br ON b.id = br.book_id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);

    // Parse JSON fields and add reviews
    const booksWithReviews = await Promise.all(
      books.map(async (book) => {
        // Get reviews for this book
        const [reviews] = await pool.execute(
          'SELECT user_name, rating, comment, created_at FROM book_reviews WHERE book_id = ? ORDER BY created_at DESC LIMIT 5',
          [book.id]
        );

        return {
          id: book.id,
          title: book.title,
          author: book.author,
          genres: JSON.parse(book.genres),
          tags: JSON.parse(book.tags),
          lengthHours: book.length_hours,
          summary: book.summary,
          cover: book.cover_url,
          rating: parseFloat(book.avg_rating).toFixed(1),
          reviews: reviews.map(review => ({
            user: review.user_name,
            rating: review.rating,
            comment: review.comment,
            date: review.created_at
          }))
        };
      })
    );

    res.json(booksWithReviews);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get book by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [books] = await pool.execute(
      'SELECT * FROM books WHERE id = ?',
      [id]
    );

    if (books.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const book = books[0];

    // Get reviews
    const [reviews] = await pool.execute(
      'SELECT user_name, rating, comment, created_at FROM book_reviews WHERE book_id = ? ORDER BY created_at DESC',
      [id]
    );

    const bookData = {
      id: book.id,
      title: book.title,
      author: book.author,
      genres: JSON.parse(book.genres),
      tags: JSON.parse(book.tags),
      lengthHours: book.length_hours,
      summary: book.summary,
      cover: book.cover_url,
      rating: book.rating,
      reviews: reviews.map(review => ({
        user: review.user_name,
        rating: review.rating,
        comment: review.comment,
        date: review.created_at
      }))
    };

    res.json(bookData);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Search books
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = `%${query.toLowerCase()}%`;

    const [books] = await pool.execute(`
      SELECT * FROM books 
      WHERE LOWER(title) LIKE ? 
         OR LOWER(author) LIKE ? 
         OR LOWER(genres) LIKE ?
      ORDER BY title
    `, [searchTerm, searchTerm, searchTerm]);

    const booksData = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      genres: JSON.parse(book.genres),
      tags: JSON.parse(book.tags),
      lengthHours: book.length_hours,
      summary: book.summary,
      cover: book.cover_url,
      rating: book.rating
    }));

    res.json(booksData);
  } catch (error) {
    console.error('Search books error:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

module.exports = router;