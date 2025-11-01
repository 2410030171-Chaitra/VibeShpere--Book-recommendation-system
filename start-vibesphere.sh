#!/bin/bash
# 📚 VibeSphere - Complete Startup Script
# Starts both backend and frontend servers

echo "🚀 Starting VibeSphere..."
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if backend dependencies are installed
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd "$SCRIPT_DIR/backend"
  npm install
fi

# Check if frontend dependencies are installed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd "$SCRIPT_DIR"
  npm install
fi

# Start backend in background
echo "🔧 Starting backend server on port 3001..."
cd "$SCRIPT_DIR/backend"
PORT=3001 node server.js > /tmp/vibesphere-backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo "   Log: /tmp/vibesphere-backend.log"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..20}; do
  if curl -s http://localhost:3001/api/recommendations/trending?limit=1 > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  if [ $i -eq 20 ]; then
    echo "⚠️  Backend taking longer than expected, but continuing..."
  fi
  sleep 1
done

echo ""
echo "🎨 Starting frontend server..."
cd "$SCRIPT_DIR"
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 VibeSphere is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3001"
echo ""
echo "👉 Open http://localhost:5173 in your browser"
echo "👉 Click 'Discover' to start browsing books"
echo ""
echo "To stop servers:"
echo "  Press Ctrl+C in this terminal"
echo "  Or run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs for cleanup
echo $BACKEND_PID > /tmp/vibesphere-backend.pid
echo $FRONTEND_PID > /tmp/vibesphere-frontend.pid

# Wait for frontend (it runs in foreground)
wait $FRONTEND_PID

# Cleanup
echo ""
echo "🛑 Stopping servers..."
kill $BACKEND_PID 2>/dev/null
rm /tmp/vibesphere-backend.pid 2>/dev/null
rm /tmp/vibesphere-frontend.pid 2>/dev/null
echo "✅ Servers stopped"
