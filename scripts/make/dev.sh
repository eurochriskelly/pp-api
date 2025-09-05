#!/bin/bash

# Colors
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
RESET='\033[0m'

trap 'rm -f "$pidfile"' EXIT

# Generate trace
trace=$$

echo -e "${BLUE}[INIT]${RESET} Trace ID: $trace"

mkdir -p ./logs/temp
mkdir -p ./pids
logfile="./logs/temp/start-$trace.log"
pidfile="./pids/start-$trace.pid"
> "$logfile"
echo "$trace" > "$pidfile"

if [ -z "$1" ]; then
    read -p "Which environment? [production/acceptance]: " env
else
    env=$1
fi
port=${2:-4000}

if [ "$env" = "production" ]; then
    dbn="EuroTourno"
    param="production/mobile"
elif [ "$env" = "acceptance" ]; then
    dbn="AccTourno"
    param="acceptance/mobile"
else
    echo -e "${RED}[ERROR]${RESET} Invalid environment. Use 'production' or 'acceptance'"
    exit 1
fi

echo -e "${BLUE}[CONFIG]${RESET} Environment: $env, Port: $port, DB: $dbn"
echo "env=$env" >> "$pidfile"
echo "port=$port" >> "$pidfile"
echo "dbn=$dbn" >> "$pidfile"
echo "Run \`make follow TRACE=$trace\` to follow the logs."
echo "Log file: $logfile"

if lsof -i :$port > /dev/null; then
    echo -e "${RED}[ERROR]${RESET} Port $port is already in use. Use 'make kill' to stop existing instances."
    exit 1
fi

# Set environment variables needed for the server (matching start-server.sh)
export PP_DBN=$dbn
export PORT=$port
export APP=$param
export USE_MOCK="false"
export DATABASE=$dbn

echo -e "${GREEN}[DEV]${RESET} Starting development server with watch mode..."
npm run dev >> "$logfile" 2>&1 &
dev_pid=$!

# Update pidfile with the dev process PID
echo "$dev_pid" > "$pidfile"

# Trap to clean up on exit
trap 'kill $dev_pid 2>/dev/null; rm -f "$pidfile"; echo -e "${YELLOW}[EXIT]${RESET} Dev mode stopped." | tee -a "$logfile"' EXIT

# Wait for the dev process to exit
wait $dev_pid
