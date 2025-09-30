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

mkdir -p ./logs
mkdir -p ./pids
# Always use the same log file
logfile="./logs/server.log"
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
echo "Run \`make follow\` to follow the logs."
echo "Log file: $logfile"

pids=$(lsof -ti :$port)
if [ -n "$pids" ]; then
    echo -e "${YELLOW}[WARN]${RESET} Processes found on port $port: $pids. Killing them..." | tee -a "$logfile"
    kill -9 $pids
    sleep 1  # Give time for the port to be released
    if lsof -i :$port > /dev/null; then
        echo -e "${RED}[ERROR]${RESET} Failed to free port $port. Please check manually." | tee -a "$logfile"
        exit 1
    fi
    echo -e "${GREEN}[SUCCESS]${RESET} Port $port is now free." | tee -a "$logfile"
fi

if [ "${WATCH:-false}" = "true" ]; then
    if ! command -v tsc >/dev/null; then
        echo -e "${RED}[ERROR]${RESET} The 'tsc' command is not found on your system."
        echo "tsc is part of TypeScript, which is needed to compile the code."
        echo "To install it, open your terminal and run:"
        echo "    npm install -g typescript"
        echo "If you don't have npm installed, you'll need to install Node.js first from https://nodejs.org/"
        echo "After installation, try running this script again."
        exit 1
    fi

    if ! command -v nodemon >/dev/null && ! [ -f "./node_modules/.bin/nodemon" ]; then
        echo -e "${RED}[ERROR]${RESET} nodemon not found. Install it with: npm install"
        exit 1
    fi

    echo -e "${GREEN}[BUILD]${RESET} Starting tsc --watch..." | tee -a "$logfile"
    tsc -w >> "$logfile" 2>&1 &
    tsc_pid=$!

    echo -e "${GREEN}[LAUNCH]${RESET} Starting server with nodemon... at time [$(date)]" | tee -a "$logfile"
    PP_DBN=$dbn ./scripts/start-server.sh $port $param false $dbn >> "$logfile" 2>&1 &
    server_pid=$!

    trap 'kill $tsc_pid 2>/dev/null; kill $server_pid 2>/dev/null; rm -f "$pidfile"; echo -e "${YELLOW}[EXIT]${RESET} Watch mode stopped." | tee -a "$logfile"' EXIT

    wait $server_pid
else
    echo -e "${GREEN}[BUILD]${RESET} Compiling TypeScript..."
    npm run build >> "$logfile" 2>&1

    while true; do
        echo -e "${GREEN}[LAUNCH]${RESET} Starting server at time [$(date)] ..."
        PP_DBN=$dbn ./scripts/start-server.sh $port $param false $dbn >> "$logfile" 2>&1 &
        server_pid=$!
        trap 'kill $server_pid 2>/dev/null; rm -f "$pidfile"; echo -e "${YELLOW}[EXIT]${RESET} Server stopped." | tee -a "$logfile"' EXIT
        wait $server_pid
        exit_code=$?
        trap 'rm -f "$pidfile"' EXIT
        echo -e "${RED}[STOP]${RESET} Server stopped (code $exit_code) at time [$(date)], restarting in 5 seconds..." | tee -a "$logfile"
        sleep 5
    done
fi
