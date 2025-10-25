#!/bin/bash

# VibeSphere - Quick Start Script
# This script starts both the backend and frontend servers

echo "🚀 Starting VibeSphere - AI Book Recommendation Website"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env with your Firebase credentials!${NC}"
fi

# Kill any existing processes on ports 3001 and 5173
echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend server
echo -e "${GREEN}🔧 Starting backend server on port 3001...${NC}"
cd backend && npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend server
echo -e "${GREEN}💻 Starting frontend server on port 5173...${NC}"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

echo ""
echo -e "${GREEN}✅ VibeSphere is now running!${NC}"
echo "================================================"
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:3001/api"
echo -e "${BLUE}📚 Trending Books:${NC} http://localhost:3001/api/recommendations/trending"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC} If Google Sign-In doesn't work:"
echo "   1. Edit .env file with your Firebase credentials"
echo "   2. Restart by pressing Ctrl+C and running this script again"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
