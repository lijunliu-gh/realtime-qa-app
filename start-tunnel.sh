#!/usr/bin/env bash
# Start dev tunnel for Teams integration (requires `devtunnel` CLI).
# Usage: ./start-tunnel.sh
#
# Prerequisites:
#   brew install --cask devtunnel
#   devtunnel user login
#   Create .env from .env.example with your TUNNEL_NAME

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load TUNNEL_NAME from .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  TUNNEL_NAME=$(grep -E '^\s*TUNNEL_NAME\s*=' "$SCRIPT_DIR/.env" | sed 's/^[^=]*=\s*//' | tr -d '[:space:]')
fi

if [ -z "$TUNNEL_NAME" ]; then
  echo "ERROR: TUNNEL_NAME not found in .env"
  echo "  cp .env.example .env  # then set TUNNEL_NAME"
  exit 1
fi

if ! command -v devtunnel &>/dev/null; then
  echo "Error: devtunnel CLI not found."
  echo "Install it with: brew install --cask devtunnel"
  exit 1
fi

echo "Starting dev tunnel '$TUNNEL_NAME'..."

devtunnel host "$TUNNEL_NAME" --allow-anonymous &
TUNNEL_PID=$!

cleanup() {
  echo ""
  echo "Shutting down tunnel..."
  kill "$TUNNEL_PID" 2>/dev/null
  wait "$TUNNEL_PID" 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM

echo ""
echo "=== Dev Tunnel ==="
echo "  Tunnel PID: $TUNNEL_PID"
echo "  Press Ctrl+C to stop."

wait
