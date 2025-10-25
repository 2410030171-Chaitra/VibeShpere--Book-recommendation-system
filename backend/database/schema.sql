-- CalmReads Database Schema

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    favorite_genres JSON,
    history_tags JSON,
    time_budget_hours INT DEFAULT 6,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Books table
CREATE TABLE books (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255) NOT NULL,
    genres JSON NOT NULL,
    tags JSON NOT NULL,
    length_hours INT NOT NULL,
    summary TEXT NOT NULL,
    cover_url TEXT,
    rating DECIMAL(3,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User ratings table
CREATE TABLE user_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id VARCHAR(50) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_book (user_id, book_id)
);

-- User library table (books added to personal library)
CREATE TABLE user_library (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id VARCHAR(50) NOT NULL,
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_library_book (user_id, book_id)
);

-- Book reviews table
CREATE TABLE book_reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    book_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Insert sample books data
INSERT INTO books (id, title, author, genres, tags, length_hours, summary, cover_url, rating) VALUES
('b1', 'Whispers of the Valley', 'Anita Rao', '["Romance", "Contemporary", "Fiction"]', '["slow-burn", "heartwarming", "rural"]', 6, 'A gentle tale of two strangers who find comfort and courage in a small valley town.', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop', 4.2),
('b2', 'The Clockmaker\'s Paradox', 'Max Ellery', '["Science Fiction", "Mystery", "Fiction"]', '["time travel", "twist", "clever"]', 9, 'A sleuth entangled in a timeline he cannot trust, with clues hidden between tenses.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop', 4.7),
('b3', 'Ink & Ivory', 'Zara Malik', '["Literary", "Drama", "Fiction"]', '["coming-of-age", "art", "city"]', 7, 'A young artist navigates love, loss, and ambition in a sprawling coastal city.', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=600&auto=format&fit=crop', 4.5),
('b4', 'Midnight in Kashi', 'R. Sen', '["Historical", "Mystery", "Fiction"]', '["India", "river", "rituals"]', 5, 'An archivist uncovers a century-old secret along the ghats, where time moves like water.', 'https://images.unsplash.com/photo-1520637836862-4d197d17c89a?q=80&w=600&auto=format&fit=crop', 4.3),
('b5', 'Quantum Tea & Other Stories', 'J. Liu', '["Short Stories", "Speculative", "Fiction"]', '["anthology", "imaginative", "bite-sized"]', 3, 'Playful, thought-provoking shorts brewed with physics and feelings.', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=600&auto=format&fit=crop', 4.1),
('b9', 'The Art of Mindful Living', 'Dr. Sarah Chen', '["Self-Help", "Psychology", "Non-Fiction"]', '["mindfulness", "meditation", "wellness"]', 4, 'A practical guide to incorporating mindfulness into everyday life for better mental health.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop', 4.8),
('b10', 'Digital Minimalism', 'Cal Newport', '["Technology", "Lifestyle", "Non-Fiction"]', '["productivity", "technology", "minimalism"]', 6, 'A philosophy for intentional technology use in a world of overwhelming digital clutter.', 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?q=80&w=600&auto=format&fit=crop', 4.5),
('b11', 'The Hidden History of Women Scientists', 'Dr. Maria Rodriguez', '["History", "Science", "Non-Fiction"]', '["women", "science", "history"]', 8, 'Uncovering the forgotten contributions of women to scientific discovery throughout history.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop', 4.7);

-- Insert sample users
INSERT INTO users (name, email, password_hash, favorite_genres, history_tags, time_budget_hours) VALUES
('Alice Johnson', 'alice@example.com', '$2b$10$hashedpassword1', '["Romance", "Contemporary"]', '["heartwarming", "slow-burn"]', 8),
('Bob Smith', 'bob@example.com', '$2b$10$hashedpassword2', '["Science Fiction", "Mystery"]', '["time travel", "clever"]', 5),
('Carol Davis', 'carol@example.com', '$2b$10$hashedpassword3', '["Self-Help", "Psychology"]', '["mindfulness", "wellness"]', 6),
('David Wilson', 'david@example.com', '$2b$10$hashedpassword4', '["History", "Science"]', '["women", "science"]', 10),
('Emma Brown', 'emma@example.com', '$2b$10$hashedpassword5', '["Literary", "Drama"]', '["coming-of-age", "art"]', 4);

-- Insert sample user ratings
INSERT INTO user_ratings (user_id, book_id, rating) VALUES
(1, 'b1', 5),
(1, 'b3', 4),
(2, 'b2', 5),
(2, 'b4', 4),
(3, 'b9', 5),
(3, 'b10', 4),
(4, 'b11', 5),
(4, 'b2', 4),
(5, 'b3', 5),
(5, 'b1', 4);

-- Insert sample library items
INSERT INTO user_library (user_id, book_id, progress) VALUES
(1, 'b1', 100),
(1, 'b3', 75),
(2, 'b2', 100),
(2, 'b5', 30),
(3, 'b9', 100),
(3, 'b10', 50),
(4, 'b11', 80),
(5, 'b3', 60);

-- Insert sample reviews
INSERT INTO book_reviews (book_id, user_name, rating, comment) VALUES
('b1', 'BookLover23', 5, 'Absolutely beautiful storytelling. Made me cry happy tears!'),
('b1', 'RomanceReader', 4, 'Sweet and slow-paced, perfect for a cozy weekend.'),
('b2', 'SciFiGeek', 5, 'Mind-bending plot that keeps you guessing until the end!'),
('b2', 'MysteryFan', 4, 'Clever writing, though it took me a while to follow the timeline.'),
('b9', 'WellnessJourney', 5, 'Life-changing! Simple yet profound techniques.'),
('b9', 'BusyParent', 5, 'Finally found mindfulness practices that fit my hectic schedule.');

-- Create indexes for better performance
CREATE INDEX idx_books_genres ON books((CAST(genres AS CHAR(1000))));
CREATE INDEX idx_user_ratings_user_id ON user_ratings(user_id);
CREATE INDEX idx_user_ratings_book_id ON user_ratings(book_id);
CREATE INDEX idx_user_library_user_id ON user_library(user_id);
CREATE INDEX idx_book_reviews_book_id ON book_reviews(book_id);