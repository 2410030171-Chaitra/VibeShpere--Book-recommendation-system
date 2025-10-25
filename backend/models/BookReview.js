const mongoose = require('mongoose');

const bookReviewSchema = new mongoose.Schema({
  book_id: {
    type: String,
    ref: 'Book',
    required: true
  },
  user_name: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BookReview', bookReviewSchema);