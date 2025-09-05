#!/bin/bash

# Colors
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
    echo -e "${RED}[ERROR]${RESET} PID file for TRACE $trace not found."
    exit 1
fi

echo -e "${BLUE}[WATCH]${RESET} Starting watch mode for TRACE $trace" | tee -a "$logfile"

# Check if tsc is installed
if ! command -v tsc >/dev/null; then
    echo -e "${RED}[ERROR]${RESET} tsc not found. Please install TypeScript globally with: npm install -g typescript"
    exit 1
fi

# Start tsc -w in background
echo -e "${GREEN}[BUILD]${RESET} Starting tsc --watch..." | tee -a "$logfile"
tsc -w >> "$logfile" 2>&1 &
tsc_pid=$!

# Trap to clean up tsc on exit
trap 'kill $tsc_pid 2>/dev/null; echo -e "${YELLOW}[EXIT]${RESET} Watch mode stopped." | tee -a "$logfile"' EXIT

# Function for change detection
has_dist_changed() {
    current_checksum=$( (find dist/ -type f -exec md5 -q {} \; 2>/dev/null | sort) | md5 -q 2>/dev/null || echo "")
    if [ "$current_checksum" != "$last_checksum" ]; then
        last_checksum="$current_checksum"
        return 0
    fi
    return 1
}

# Initial checksum
last_checksum=$( (find dist/ -type f -exec md5 -q {} \; 2>/dev/null | sort) | md5 -q 2>/dev/null || echo "")

# Watch loop
while true; do
    if has_dist_changed; then
        server_pid=$(cat "$pidfile" 2>/dev/null)
        if [ -n "$server_pid" ] && kill -0 $server_pid 2>/dev/null; then
            echo -e "${YELLOW}[RESTART]${RESET} Changes detected. Killing server PID $server_pid to trigger restart..." | tee -a "$logfile"
            kill $server_pid
        fi
    fi
    sleep 2
done
