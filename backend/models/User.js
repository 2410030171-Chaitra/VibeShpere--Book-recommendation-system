const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  favorite_genres: [{
    type: String
  }],
  history_tags: [{
    type: String
  }],
  time_budget_hours: {
    type: Number,
    default: 6
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);