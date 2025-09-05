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
    echo -e "${RED}[ERROR]${RESET} The 'tsc' command is not found on your system."
    echo "tsc is part of TypeScript, which is needed to compile the code."
    echo "To install it, open your terminal and run:"
    echo "    npm install -g typescript"
    echo "If you don't have npm installed, you'll need to install Node.js first from https://nodejs.org/"
    echo "After installation, try running this script again."
    exit 1
fi

# Start tsc -w in background
echo -e "${GREEN}[BUILD]${RESET} Starting tsc --watch..." | tee -a "$logfile"
tsc -w >> "$logfile" 2>&1 &
tsc_pid=$!

# Check for nodemon
if ! command -v nodemon >/dev/null && ! [ -f "./node_modules/.bin/nodemon" ]; then
    echo -e "${RED}[ERROR]${RESET} nodemon not found. Install it with: npm install"
    exit 1
fi

# Start nodemon to watch dist/ and kill server on changes
echo -e "${GREEN}[WATCH]${RESET} Starting nodemon to monitor dist/..." | tee -a "$logfile"
npx nodemon --watch dist/ --exec "bash -c 'server_pid=\$(cat \"$pidfile\" 2>/dev/null); if [ -n \"\$server_pid\" ] && kill -0 \$server_pid 2>/dev/null; then echo -e \"${YELLOW}[RESTART]${RESET} Changes detected. Killing server PID \$server_pid to trigger restart...\" | tee -a \"$logfile\"; kill \$server_pid; fi'" >> "$logfile" 2>&1 &
nodemon_pid=$!

# Trap to clean up on exit
trap 'kill $tsc_pid 2>/dev/null; kill $nodemon_pid 2>/dev/null; echo -e "${YELLOW}[EXIT]${RESET} Watch mode stopped." | tee -a "$logfile"' EXIT

# Wait indefinitely (until interrupted)
wait
