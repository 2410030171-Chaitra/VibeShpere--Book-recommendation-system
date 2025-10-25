const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Book = require('./models/Book');
const UserRating = require('./models/UserRating');
const UserLibrary = require('./models/UserLibrary');
const BookReview = require('./models/BookReview');

const seedData = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/calmreads_db';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Book.deleteMany({});
    await UserRating.deleteMany({});
    await UserLibrary.deleteMany({});
    await BookReview.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Insert books
    const books = [
      {
        _id: 'b1',
        title: 'Whispers of the Valley',
        author: 'Anita Rao',
        genres: ['Romance', 'Contemporary', 'Fiction'],
        tags: ['slow-burn', 'heartwarming', 'rural'],
        length_hours: 6,
        summary: 'A gentle tale of two strangers who find comfort and courage in a small valley town.',
        cover_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop',
        rating: 4.2
      },
      {
        _id: 'b2',
        title: "The Clockmaker's Paradox",
        author: 'Max Ellery',
        genres: ['Science Fiction', 'Mystery', 'Fiction'],
        tags: ['time travel', 'twist', 'clever'],
        length_hours: 9,
        summary: 'A sleuth entangled in a timeline he cannot trust, with clues hidden between tenses.',
        cover_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
        rating: 4.7
      },
      {
        _id: 'b3',
        title: 'Ink & Ivory',
        author: 'Zara Malik',
        genres: ['Literary', 'Drama', 'Fiction'],
        tags: ['coming-of-age', 'art', 'city'],
        length_hours: 7,
        summary: 'A young artist navigates love, loss, and ambition in a sprawling coastal city.',
        cover_url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=600&auto=format&fit=crop',
        rating: 4.5
      },
      {
        _id: 'b9',
        title: 'The Art of Mindful Living',
        author: 'Dr. Sarah Chen',
        genres: ['Self-Help', 'Psychology', 'Non-Fiction'],
        tags: ['mindfulness', 'meditation', 'wellness'],
        length_hours: 4,
        summary: 'A practical guide to incorporating mindfulness into everyday life for better mental health.',
        cover_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop',
        rating: 4.8
      },
      {
        _id: 'b10',
        title: 'Digital Minimalism',
        author: 'Cal Newport',
        genres: ['Technology', 'Lifestyle', 'Non-Fiction'],
        tags: ['productivity', 'technology', 'minimalism'],
        length_hours: 6,
        summary: 'A philosophy for intentional technology use in a world of overwhelming digital clutter.',
        cover_url: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?q=80&w=600&auto=format&fit=crop',
        rating: 4.5
      }
    ];

    await Book.insertMany(books);
    console.log('📚 Inserted books');

    // Insert users
    const users = [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password_hash: '$2b$10$hashedpassword1',
        favorite_genres: ['Romance', 'Contemporary'],
        history_tags: ['heartwarming', 'slow-burn'],
        time_budget_hours: 8
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        password_hash: '$2b$10$hashedpassword2',
        favorite_genres: ['Science Fiction', 'Mystery'],
        history_tags: ['time travel', 'clever'],
        time_budget_hours: 5
      },
      {
        name: 'Carol Davis',
        email: 'carol@example.com',
        password_hash: '$2b$10$hashedpassword3',
        favorite_genres: ['Self-Help', 'Psychology'],
        history_tags: ['mindfulness', 'wellness'],
        time_budget_hours: 6
      }
    ];

    const insertedUsers = await User.insertMany(users);
    console.log('👥 Inserted users');

    // Insert ratings
    const ratings = [
      { user_id: insertedUsers[0]._id, book_id: 'b1', rating: 5 },
      { user_id: insertedUsers[0]._id, book_id: 'b3', rating: 4 },
      { user_id: insertedUsers[1]._id, book_id: 'b2', rating: 5 },
      { user_id: insertedUsers[2]._id, book_id: 'b9', rating: 5 },
      { user_id: insertedUsers[2]._id, book_id: 'b10', rating: 4 }
    ];

    await UserRating.insertMany(ratings);
    console.log('⭐ Inserted ratings');

    // Insert library items
    const libraryItems = [
      { user_id: insertedUsers[0]._id, book_id: 'b1', progress: 100 },
      { user_id: insertedUsers[0]._id, book_id: 'b3', progress: 75 },
      { user_id: insertedUsers[1]._id, book_id: 'b2', progress: 100 },
      { user_id: insertedUsers[2]._id, book_id: 'b9', progress: 100 }
    ];

    await UserLibrary.insertMany(libraryItems);
    console.log('📖 Inserted library items');

    // Insert reviews
    const reviews = [
      {
        book_id: 'b1',
        user_name: 'BookLover23',
        rating: 5,
        comment: 'Absolutely beautiful storytelling. Made me cry happy tears!'
      },
      {
        book_id: 'b2',
        user_name: 'SciFiGeek',
        rating: 5,
        comment: 'Mind-bending plot that keeps you guessing until the end!'
      },
      {
        book_id: 'b9',
        user_name: 'WellnessJourney',
        rating: 5,
        comment: 'Life-changing! Simple yet profound techniques.'
      }
    ];

    await BookReview.insertMany(reviews);
    console.log('💬 Inserted reviews');

    console.log('🎉 Sample data seeded successfully!');
    
    // Display stats
    const stats = {
      users: await User.countDocuments(),
      books: await Book.countDocuments(),
      ratings: await UserRating.countDocuments(),
      library: await UserLibrary.countDocuments(),
      reviews: await BookReview.countDocuments()
    };
    
    console.log('📊 Database Stats:', stats);
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
  }
};

seedData();