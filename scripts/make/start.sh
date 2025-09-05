#!/bin/bash

# Colors
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
RESET='\033[0m'

# Generate trace
trace=$(date | md5 | cut -c 1-4 | tr 'a-z' 'A-Z')

echo -e "${BLUE}[INIT]${RESET} Trace ID: $trace"

mkdir -p ./logs/temp
logfile="./logs/temp/start-$trace.log"
> "$logfile"

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
echo "Run \`make follow TRACE=$trace\` to follow the logs."
echo "Log file: $logfile"

while true; do
    echo -e "${GREEN}[LAUNCH]${RESET} Starting server..."
    ( PP_DBN=$dbn ./scripts/start-server.sh $port $param false $dbn >> "$logfile" 2>&1 ) || \
    ( echo -e "${RED}[CRASH]${RESET} Server crashed, restarting in 5 seconds..." | tee /dev/tty >> "$logfile" && sleep 5 )
done
