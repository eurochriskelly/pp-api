#!/bin/bash

# Colors (matching your other scripts)
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

trace=$1
if [ -z "$trace" ]; then
    echo -e "${RED}[ERROR]${RESET} No TRACE provided."
    exit 1
fi

pidfile="./pids/start-$trace.pid"
logfile="./logs/temp/start-$trace.log"

if [ ! -f "$pidfile" ]; then
    echo -e "${RED}[ERROR]${RESET} PID file for TRACE $trace not found. Start the server with 'make start' first."
    exit 1
fi

# Load details from pidfile
pid=$(head -n 1 "$pidfile")
env=$(grep '^env=' "$pidfile" | cut -d= -f2)
port=$(grep '^port=' "$pidfile" | cut -d= -f2)
dbn=$(grep '^dbn=' "$pidfile" | cut -d= -f2)

echo -e "${BLUE}[WATCH]${RESET} Starting watch mode for TRACE $trace (PID: $pid, Env: $env, Port: $port, DB: $dbn)" | tee -a "$logfile"

# Kill any existing server process to ensure clean start in watch mode
echo -e "${YELLOW}[INIT]${RESET} Stopping existing server if running..." | tee -a "$logfile"
kill $pid 2>/dev/null || true

# Set environment variables needed for the server (matching start-server.sh)
export PP_DBN=$dbn
export PORT=$port
export APP=$( [ "$env" = "production" ] && echo "production/mobile" || echo "acceptance/mobile" )
export USE_MOCK="false"
export DATABASE=$dbn

# Run the existing 'dev' script, redirecting output to the log file
echo -e "${GREEN}[DEV]${RESET} Running npm run dev with logging..." | tee -a "$logfile"
npm run dev >> "$logfile" 2>&1 &
dev_pid=$!

# Update pidfile with the new dev process PID
echo "$dev_pid" > "$pidfile"

# Trap to clean up on exit
trap 'kill $dev_pid 2>/dev/null; echo -e "${YELLOW}[EXIT]${RESET} Watch mode stopped." | tee -a "$logfile"' EXIT

# Wait for the dev process to exit (e.g., via Ctrl+C or error)
wait $dev_pid
