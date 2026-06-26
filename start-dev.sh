#!/usr/bin/env bash
# Start backend (FastAPI) and frontend (Vite) in parallel.
# Usage: ./start-dev.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM

# --- Backend ---
(
  cd "$ROOT/backend"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install -q -r requirements.txt
  python -m uvicorn main:app --reload --port 8000
) &
BACKEND_PID=$!

# --- Frontend ---
(
  cd "$ROOT/frontend"
  npm install --silent
  npx vite --port 5173
) &
FRONTEND_PID=$!

sleep 2
echo ""
echo "=== RealtimeQA Dev Servers ==="
echo "  Backend:  http://localhost:8000  (PID $BACKEND_PID)"
echo "  Frontend: http://localhost:5173  (PID $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop."

wait
