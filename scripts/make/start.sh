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

echo -e "${GREEN}[BUILD]${RESET} Compiling TypeScript..."
npm run build >> "$logfile" 2>&1

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

while true; do
    echo -e "${GREEN}[LAUNCH]${RESET} Starting server..."
    PP_DBN=$dbn ./scripts/start-server.sh $port $param false $dbn >> "$logfile" 2>&1 &
    server_pid=$!
    wait $server_pid
    exit_code=$?
    echo -e "${RED}[STOP]${RESET} Server stopped (code $exit_code), restarting in 5 seconds..." | tee /dev/tty >> "$logfile"
    sleep 5
done
