#!/bin/bash

# VibeSphere Database Viewer
# Interactive tool to manage and view your book database

# Database configuration
DB_HOST="localhost"
DB_NAME="calmreads_db"
DB_USER="root"

echo "🗄️  VibeSphere Database Viewer"
echo "================================"
echo "📊 Database Connection Info:"
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Function to show available commands
show_commands() {
    echo "🔧 Available Commands:"
    echo "1. Connect to MySQL: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME"
    echo "2. Show tables: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e 'SHOW TABLES;'"
    echo "3. View users: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e 'SELECT * FROM users;'"
    echo "4. View books: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e 'SELECT id, title, author FROM books;'"
    echo ""
}

# Show menu
show_menu() {
    echo "What would you like to do?"
    echo "1) Create the database"
    echo "2) View all tables"
    echo "3) View sample data"
    echo "4) Connect to MySQL shell"
    echo "5) Exit"
    echo -n "Enter your choice (1-5): "
}

# Create database and import schema
create_database() {
    echo "Creating database..."
    mysql -u $DB_USER -p -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
    
    if [ $? -eq 0 ]; then
        echo "Importing schema..."
        mysql -u $DB_USER -p $DB_NAME < backend/database/schema.sql
        echo "✅ Database created successfully!"
    else
        echo "❌ Failed to create database"
    fi
}

# View all tables
view_tables() {
    echo "📋 Tables in your database:"
    mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e "SHOW TABLES;"
}

# View sample data
view_sample_data() {
    echo "📚 Sample Books:"
    mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e "SELECT id, title, author, rating FROM books LIMIT 5;"
    
    echo ""
    echo "💬 Sample Reviews:"
    mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e "SELECT user_name, rating, comment FROM book_reviews LIMIT 3;"
    
    echo ""
    echo "📊 Database Stats:"
    mysql -h $DB_HOST -u $DB_USER -p $DB_NAME -e "
        SELECT 
            (SELECT COUNT(*) FROM users) as Users,
            (SELECT COUNT(*) FROM books) as Books,
            (SELECT COUNT(*) FROM user_ratings) as Ratings,
            (SELECT COUNT(*) FROM book_reviews) as Reviews;
    "
}

# Connect to MySQL shell
connect_mysql() {
    echo "🔗 Connecting to MySQL shell..."
    echo "You can run SQL commands directly. Type 'exit' to return."
    mysql -h $DB_HOST -u $DB_USER -p $DB_NAME
}

# Main menu loop
show_commands
while true; do
    echo ""
    show_menu
    read choice
    
    case $choice in
        1)
            create_database
            ;;
        2)
            view_tables
            ;;
        3)
            view_sample_data
            ;;
        4)
            connect_mysql
            ;;
        5)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please enter 1-5."
            ;;
    esac
done
