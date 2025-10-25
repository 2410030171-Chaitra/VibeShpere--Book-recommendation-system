const mongoose = require('mongoose');

const userLibrarySchema = new mongoose.Schema({
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
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Ensure unique user-book combination
userLibrarySchema.index({ user_id: 1, book_id: 1 }, { unique: true });

module.exports = mongoose.model('UserLibrary', userLibrarySchema);