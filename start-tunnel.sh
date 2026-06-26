#!/usr/bin/env bash
# Start dev tunnel for Teams integration (requires `devtunnel` CLI).
# Usage: ./start-tunnel.sh
#
# Prerequisites:
#   brew install --cask devtunnel
#   devtunnel user login

set -e

if ! command -v devtunnel &>/dev/null; then
  echo "Error: devtunnel CLI not found."
  echo "Install it with: brew install --cask devtunnel"
  exit 1
fi

echo "Starting dev tunnel on port 5173..."

devtunnel host --port-numbers 5173 --allow-anonymous &
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
