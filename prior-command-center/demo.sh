#!/bin/bash
# Prior Command Center — Demo Launcher
# Run this before your review: ./demo.sh

cd "$(dirname "$0")"

echo "🏢 Starting Prior Command Center..."
echo ""

# Kill any existing processes on our ports
lsof -ti:3002 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# Start Express backend
echo "  Starting backend on :3002..."
node server/index.js &
BACKEND_PID=$!
sleep 2

# Start Vite dev server
echo "  Starting frontend on :5173..."
npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo "✅ Ready! Open http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to clean up both processes
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Wait for either to exit
wait
