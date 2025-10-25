const mongoose = require('mongoose');

const userRatingSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  book_id: {
    type: String,
    ref: 'Book',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
});

// Ensure unique user-book combination
userRatingSchema.index({ user_id: 1, book_id: 1 }, { unique: true });

module.exports = mongoose.model('UserRating', userRatingSchema);