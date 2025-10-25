#!/bin/bash

#!/bin/bash

set -e
START_TIME=$(date +%s)
echo "🚀 Starting VibeSphere Website..."

# Helper: get first non-loopback IPv4
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "Local IP: $LOCAL_IP"

# Ensure required commands exist
command -v npm >/dev/null 2>&1 || { echo "npm not found. Install Node/npm first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node not found. Install Node.js first."; exit 1; }

# (Optional) start MongoDB only if user expects it and it's installed
if command -v mongod >/dev/null 2>&1; then
    if ! pgrep -x "mongod" > /dev/null; then
        echo "📊 Starting MongoDB (found locally)..."
        if command -v brew >/dev/null 2>&1; then
            brew services start mongodb/brew/mongodb-community || echo "brew start failed; you may start mongod manually"
        else
            echo "mongod is installed but Homebrew not found; please start mongod manually if needed."
        fi
    else
        echo "MongoDB already running"
    fi
else
    echo "MongoDB not installed locally; skipping DB start (if your backend needs it, ensure DB is reachable)."
fi

# Kill any previous background runs started by script
pkill -f "node .*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "🔄 Starting Backend Server (background)..."
cd backend
nohup node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "🌐 Starting Frontend Server (background)..."
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for frontend (port 5173) to become available..."
RETRY=0
MAX_RETRY=30
until lsof -iTCP:5173 -sTCP:LISTEN -P -n >/dev/null 2>&1; do
    sleep 1
    RETRY=$((RETRY+1))
    if [ $RETRY -ge $MAX_RETRY ]; then
        echo "⚠️ Frontend did not start within ${MAX_RETRY}s. Check frontend.log"
        echo "Tail frontend log: tail -n 200 frontend.log"
        break
    fi
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME-START_TIME))

echo "✅ VibeSphere Website startup finished (~${ELAPSED}s)"
echo "📱 Local: http://localhost:5173/"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "🌍 Network: http://${LOCAL_IP}:5173/"
fi
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "To stop servers, run: ./stop-website.sh"
echo "Tail logs: tail -f frontend.log backend.log"

# Open website after a brief pause if available
sleep 1
open http://localhost:5173/ || true