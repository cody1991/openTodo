#!/bin/bash
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting OpenTodo development server..."
echo ""

# Kill any existing server processes to avoid duplicates
pkill -f "node src/index.js" 2>/dev/null && echo "[0/4] Stopped existing server processes." || true

# Install dependencies
echo "[1/4] Installing backend dependencies..."
(cd "$ROOT_DIR/server" && npm install)
echo "[2/4] Installing frontend dependencies..."
(cd "$ROOT_DIR/client" && npm install)
echo ""

# Start backend
echo "[3/4] Starting backend server (port 3000)..."
(cd "$ROOT_DIR/server" && node src/index.js) &
SERVER_PID=$!

sleep 2

# Start frontend
echo "[4/4] Starting frontend dev server (port 5173)..."
(cd "$ROOT_DIR/client" && npm run dev) &
CLIENT_PID=$!

sleep 3

echo ""
echo "✅ OpenTodo is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo "   Admin:    admin / Admin123456!"
echo ""
echo "Press Ctrl+C to stop all servers."

trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
