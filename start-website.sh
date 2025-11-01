#!/bin/bash
# Operate from the script's directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || { echo "Failed to change directory to $SCRIPT_DIR"; exit 1; }

# Prefer common macOS/homebrew bin locations so node/npm are found when launched from Finder/IDE
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Load nvm if present to pick up project Node version
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
fi

# Default environment
export NODE_ENV="${NODE_ENV:-development}"

# Cleanup helper: try to stop any child servers and remove pidfiles/splash on exit
cleanup() {
    echo "⏹️ Cleaning up..."
    if [ -n "${BACKEND_PID_FILE-}" ] && [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            kill "$PID" || true
        fi
        rm -f "$BACKEND_PID_FILE" || true
    fi
    if [ -n "${FRONTEND_PID_FILE-}" ] && [ -f "$FRONTEND_PID_FILE" ]; then
        PID=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            kill "$PID" || true
        fi
        rm -f "$FRONTEND_PID_FILE" || true
    fi
    # stop_splash_server is defined later in the script
    stop_splash_server 2>/dev/null || true
}
# Keep servers alive after successful start. Only clean up on interrupts/termination.
trap cleanup INT TERM
set -euo pipefail
START_TIME=$(date +%s)
echo "🚀 Starting VibeSphere Website..."

# Usage: ./start-website.sh [dev|prod] [--migrate]
MODE=${1:-dev}
MIGRATE=false
if [ "${2:-}" = "--migrate" ] || [ "${3:-}" = "--migrate" ]; then
    MIGRATE=true
fi

# Helper: get first non-loopback IPv4 (macOS typical interfaces)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "Mode: $MODE"
echo "Local IP: $LOCAL_IP"

# Ensure required commands exist
command -v npm >/dev/null 2>&1 || { echo "npm not found. Install Node/npm first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node not found. Install Node.js first."; exit 1; }
command -v lsof >/dev/null 2>&1 || { echo "lsof not found. Install lsof (brew install lsof) for port checks."; }
command -v python3 >/dev/null 2>&1 || { echo "python3 not found. Splash page won't be available (install Python3 for immediate open)."; }

# Files & ports
# Default backend port: prefer backend/.env PORT if present, otherwise 3001 (avoid macOS services on 5000)
if [ -z "${BACKEND_PORT:-}" ]; then
    if [ -f "backend/.env" ]; then
        ENV_PORT=$(grep -E '^[[:space:]]*PORT[[:space:]]*=' backend/.env | head -n1 | sed -E 's/^[^=]*=[[:space:]]*//') || true
        if [ -n "$ENV_PORT" ]; then
            BACKEND_PORT=$ENV_PORT
        else
            BACKEND_PORT=3001
        fi
    else
        BACKEND_PORT=3001
    fi
else
    BACKEND_PORT=${BACKEND_PORT}
fi
FRONTEND_DEV_PORT=${FRONTEND_DEV_PORT:-5173}
FRONTEND_PREVIEW_PORT=${FRONTEND_PREVIEW_PORT:-3000}

# Export ports so child processes (Vite dev server, etc.) can read them
export BACKEND_PORT
export FRONTEND_DEV_PORT
export FRONTEND_PREVIEW_PORT

BACKEND_LOG="/tmp/vibesphere_backend.log"
FRONTEND_LOG_DEV="/tmp/vibesphere_frontend_dev.log"
FRONTEND_LOG_PREVIEW="/tmp/vibesphere_frontend_preview.log"
BACKEND_PID_FILE="/tmp/vibesphere_backend.pid"
FRONTEND_PID_FILE="/tmp/vibesphere_frontend.pid"
SPLASH_PORT=${SPLASH_PORT:-5172}
SPLASH_FILE="/tmp/vibesphere_splash.html"
SPLASH_LOG="/tmp/vibesphere_splash.log"
SPLASH_PID_FILE="/tmp/vibesphere_splash.pid"

# Database readiness check (MySQL)
if command -v mysql >/dev/null 2>&1; then
    echo "🔎 Checking MySQL availability..."
    # Try a lightweight TCP check on the configured port
    if nc -z 127.0.0.1 ${DB_PORT:-3306} >/dev/null 2>&1; then
        echo "✅ MySQL port ${DB_PORT:-3306} is open"
    else
        echo "⚠️  Could not verify MySQL on port ${DB_PORT:-3306}. If your DB is remote, ensure DB_HOST/DB_PORT are set."
    fi
else
    echo "ℹ️  mysql client not found; skipping DB readiness check (assuming external MySQL)."
fi

# Kill any previous runs started by this script (best-effort)
if [ -f "$BACKEND_PID_FILE" ]; then
    OLD_PID=$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_PID" ]; then
        PROC_COMM=$(ps -p "$OLD_PID" -o comm= 2>/dev/null | tr -d '\n' || true)
        if [ -n "$PROC_COMM" ] && echo "$PROC_COMM" | grep -qi "node"; then
            if kill -0 "$OLD_PID" 2>/dev/null; then
                echo "Stopping previous backend (pid $OLD_PID)"
                kill "$OLD_PID" || true
                sleep 1
            fi
        else
            echo "Found stale backend pidfile pointing at pid $OLD_PID (proc: $PROC_COMM). Removing pidfile without killing."
        fi
    fi
    rm -f "$BACKEND_PID_FILE"
fi
rm -f /tmp/dist_pid /tmp/vite.log /tmp/dist_server.log || true

run_backend() {
    echo "🔄 Starting Backend (npm start in ./backend) -> $BACKEND_LOG"
    cd backend
    # If a process is already listening on BACKEND_PORT, inspect it and only reuse
    # it if it appears to be a Node backend process (avoid reusing unrelated macOS
    # services which may also bind to low-numbered ports). If the listener does
    # not look like our backend, ignore it and start a new backend process.
    EXISTING_BACKEND_PIDS=$(lsof -tiTCP:"$BACKEND_PORT" -sTCP:LISTEN -P -n 2>/dev/null || true)
    if [ -n "$EXISTING_BACKEND_PIDS" ]; then
        for PID in $EXISTING_BACKEND_PIDS; do
            # Get the command/executable name for the pid
            PROC_COMM=$(ps -p "$PID" -o comm= 2>/dev/null | tr -d '\n' || true)
            PROC_ARGS=$(ps -p "$PID" -o args= 2>/dev/null | tr -d '\n' || true)
            # Prefer Node processes (our backend is node). If it's node, reuse it.
            if echo "$PROC_COMM $PROC_ARGS" | grep -qi "node"; then
                echo "Found existing backend-like process listening on port $BACKEND_PORT (pid $PID), reusing it"
                BACKEND_PID=$PID
                echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
                cd - >/dev/null
                return
            fi
        done
        echo "Found listener(s) on port $BACKEND_PORT but none appear to be Node backend processes; starting a new backend instance"
    fi
    if [ "$MIGRATE" = true ]; then
        echo "➡️ Running migrations before starting backend..."
        npm run migrate >> "$BACKEND_LOG" 2>&1 || echo "Migration command exited with non-zero; check $BACKEND_LOG"
    fi
    # Ensure the backend process listens on the chosen BACKEND_PORT by exporting PORT
    PORT="$BACKEND_PORT" nohup npm run start >> "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
    cd - >/dev/null
}

wait_for_backend() {
    # If the backend printed its listen URL to the log (e.g. http://localhost:3001), detect it
    if [ -f "$BACKEND_LOG" ]; then
        LOG_PORT=$(grep -oE 'http://localhost:[0-9]+' "$BACKEND_LOG" | tail -1 | sed -E 's/.*:([0-9]+)/\1/' || true)
        if [ -n "$LOG_PORT" ]; then
            BACKEND_PORT="$LOG_PORT"
            export BACKEND_PORT
            echo "Detected backend port from log: $BACKEND_PORT (exported)"
        fi
    fi
    echo "Waiting for backend health on http://127.0.0.1:$BACKEND_PORT/api/health"
    RETRY=0
    MAX_RETRY=30
    until curl -fsS --max-time 3 "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; do
        sleep 1
        RETRY=$((RETRY+1))
        if [ $RETRY -ge $MAX_RETRY ]; then
            echo "⚠️ Backend didn't respond after ${MAX_RETRY}s. Check $BACKEND_LOG"
            return 1
        fi
    done
    echo "✅ Backend is healthy"
    return 0
}
run_frontend_dev() {
    echo "🌐 Starting Frontend (dev: npm run dev) -> $FRONTEND_LOG_DEV"
    # If something is already listening on the frontend port, reuse it.
    EXISTING_FRONTEND_PID=$(lsof -tiTCP:"$FRONTEND_DEV_PORT" -sTCP:LISTEN -P -n 2>/dev/null || true)
    if [ -n "$EXISTING_FRONTEND_PID" ]; then
        echo "Found existing frontend listening on port $FRONTEND_DEV_PORT (pid $EXISTING_FRONTEND_PID), will not start a new dev server"
        FRONTEND_PID=$EXISTING_FRONTEND_PID
        echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
        return
    fi

    nohup npm run dev > "$FRONTEND_LOG_DEV" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
}

run_frontend_preview() {
    echo "📦 Building frontend (npm run build)"
    npm run build >> "$FRONTEND_LOG_PREVIEW" 2>&1 || echo "Build may have failed; check $FRONTEND_LOG_PREVIEW"
    echo "🌐 Starting preview server on port $FRONTEND_PREVIEW_PORT -> $FRONTEND_LOG_PREVIEW"
    nohup npx vite preview --port "$FRONTEND_PREVIEW_PORT" > "$FRONTEND_LOG_PREVIEW" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
}

start_splash_server() {
        # Create a tiny splash HTML that polls the frontend and redirects when ready
        cat > "$SPLASH_FILE" <<'HTML'
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>VibeSphere — starting…</title>
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff8f9;color:#333}.card{max-width:520px;padding:28px;border-radius:16px;box-shadow:0 6px 30px rgba(20,20,40,0.06);text-align:center} .logo{width:56px;height:56px;margin:0 auto 12px;background:linear-gradient(135deg,#7c3aed,#06b6d4);border-radius:12px}</style>
</head>
<body>
    <div class="card">
        <div class="logo"></div>
        <h1>VibeSphere</h1>
        <p id="msg">Starting dev server — this window will redirect automatically.</p>
    </div>
    <script>
        (function poll(){
            try{
                var img = new Image();
                img.onload = function(){ window.location = 'http://localhost:REPLACE_PORT/'; };
                img.onerror = function(){ setTimeout(poll, 700); };
                img.src = 'http://localhost:REPLACE_PORT/__probe_' + Date.now();
            }catch(e){ setTimeout(poll, 1000); }
        })();
    </script>
</body>
</html>
HTML
        # inject correct port
        sed -i.bak "s/REPLACE_PORT/$FRONTEND_DEV_PORT/g" "$SPLASH_FILE" || true

        # choose a port for splash server; prefer SPLASH_PORT, increment if taken
        PORT=$SPLASH_PORT
        while lsof -tiTCP:"$PORT" -sTCP:LISTEN -P -n >/dev/null 2>&1; do
                PORT=$((PORT+1))
        done
        SPLASH_PORT=$PORT

        # start python simple http server serving /tmp
        if command -v python3 >/dev/null 2>&1; then
                cd /tmp
                nohup python3 -m http.server "$SPLASH_PORT" > "$SPLASH_LOG" 2>&1 &
                SPLASH_PID=$!
                echo "$SPLASH_PID" > "$SPLASH_PID_FILE"
                cd - >/dev/null
                echo "Started splash server on port $SPLASH_PORT (pid $SPLASH_PID)"
        else
                echo "python3 not available — cannot start splash server"
        fi
}

stop_splash_server() {
        if [ -f "$SPLASH_PID_FILE" ]; then
                PID=$(cat "$SPLASH_PID_FILE" 2>/dev/null || true)
                if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
                        kill "$PID" || true
                fi
                rm -f "$SPLASH_PID_FILE"
        fi
        rm -f "$SPLASH_FILE" "$SPLASH_FILE.bak" || true
}

open_url_if_available() {
    URL=$1
    # Start a splash server and open it immediately so user sees a loading page
    # while the real frontend boots. The splash will poll the frontend and
    # redirect automatically when ready.
    start_splash_server || true
    if command -v open >/dev/null 2>&1; then
        if [ -f "$SPLASH_FILE" ]; then
            echo "Opening splash page: http://localhost:$SPLASH_PORT/$(basename $SPLASH_FILE)"
            open "http://localhost:$SPLASH_PORT/$(basename $SPLASH_FILE)" || echo "Failed to open splash. Opening target URL: $URL" && open "$URL" || true
        else
            echo "Splash file not available; opening target URL: $URL"
            open "$URL" || echo "Failed to open browser. You can open it manually: $URL"
        fi
    else
        echo "Open the app in your browser: $URL"
    fi

    # Meanwhile continue waiting for the frontend to become healthy and then
    # open the real URL in a new tab when it is ready.
    ( 
        RETRY=0
        MAX_RETRY=60
        until curl -fsS --max-time 2 "$URL" >/dev/null 2>&1; do
            sleep 1
            RETRY=$((RETRY+1))
            if [ $RETRY -ge $MAX_RETRY ]; then
                echo "Timed out waiting for $URL to respond. Check $FRONTEND_LOG"
                exit 1
            fi
        done
        echo "Frontend is healthy — opening real app: $URL"
        if command -v open >/dev/null 2>&1; then
            open "$URL" || true
        fi
    ) &
}

echo "Starting components..."
run_backend
if ! wait_for_backend; then
    echo "Proceeding but backend may not be healthy. Check logs: $BACKEND_LOG"
fi

if [ "$MODE" = "prod" ]; then
    run_frontend_preview
    FRONTEND_PORT=$FRONTEND_PREVIEW_PORT
    FRONTEND_LOG=$FRONTEND_LOG_PREVIEW
else
    run_frontend_dev
    FRONTEND_PORT=$FRONTEND_DEV_PORT
    FRONTEND_LOG=$FRONTEND_LOG_DEV
fi

# Wait for frontend port
echo "Waiting for frontend at port $FRONTEND_PORT..."
RETRY=0
MAX_RETRY=40
until lsof -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN -P -n >/dev/null 2>&1 || curl -I --max-time 2 "http://127.0.0.1:$FRONTEND_PORT/" >/dev/null 2>&1; do
    sleep 1
    RETRY=$((RETRY+1))
    if [ $RETRY -ge $MAX_RETRY ]; then
        echo "⚠️ Frontend did not become available within ${MAX_RETRY}s. Check $FRONTEND_LOG"
        break
    fi
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME-START_TIME))

echo "✅ VibeSphere Website startup finished (~${ELAPSED}s)"
echo "📱 Local: http://localhost:$FRONTEND_PORT/"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "🌍 Network: http://${LOCAL_IP}:$FRONTEND_PORT/"
fi
echo ""
echo "Backend PID file: $BACKEND_PID_FILE ($(cat "$BACKEND_PID_FILE" 2>/dev/null || echo 'n/a'))"
echo "Frontend PID file: $FRONTEND_PID_FILE ($(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo 'n/a'))"
echo "To stop servers, run: ./stop-website.sh or kill the PIDs from the .pid files"
echo "Tail logs: tail -f $FRONTEND_LOG $BACKEND_LOG"

open_url_if_available "http://localhost:$FRONTEND_PORT/"

exit 0