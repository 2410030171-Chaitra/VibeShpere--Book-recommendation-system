const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  genres: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  length_hours: {
    type: Number,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  cover_url: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Book', bookSchema);