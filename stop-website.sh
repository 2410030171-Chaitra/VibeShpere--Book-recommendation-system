#!/bin/bash

set -euo pipefail
echo "🛑 Stopping VibeSphere processes (best-effort)"

BACKEND_PID_FILE="/tmp/vibesphere_backend.pid"
FRONTEND_PID_FILE="/tmp/vibesphere_frontend.pid"

for f in "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"; do
  if [ -f "$f" ]; then
    pid=$(cat "$f" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      if kill -0 "$pid" 2>/dev/null; then
        echo "Killing PID $pid (from $f)"
        kill "$pid" || true
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
          echo "Force killing PID $pid"
          kill -9 "$pid" || true
        fi
      else
        echo "PID $pid from $f is not running"
      fi
    fi
    rm -f "$f" || true
  fi
done

echo "Attempting to stop lingering vite/node processes (best-effort)"
pkill -f "vite --host" || true
pkill -f "npx vite preview" || true
pkill -f "node .*server.js" || true

echo "Remaining listeners (3000, 3001, 5000, 5173):"
lsof -iTCP:3000 -sTCP:LISTEN -n -P || true
lsof -iTCP:3001 -sTCP:LISTEN -n -P || true
lsof -iTCP:5000 -sTCP:LISTEN -n -P || true
lsof -iTCP:5173 -sTCP:LISTEN -n -P || true

echo "Done. You can now run ./start-website.sh [dev|prod]"
#!/bin/bash

echo "🛑 Stopping VibeSphere Website..."

# Kill servers
pkill -f "node.*server.js" 2>/dev/null && echo "✅ Backend stopped"
pkill -f "vite" 2>/dev/null && echo "✅ Frontend stopped"

echo "🛑 VibeSphere Website Stopped!"