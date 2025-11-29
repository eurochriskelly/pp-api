#!/bin/bash

# Colors
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

# Parse make args $1=env $2=port
env=${1:-development}
port_arg=${2:-}
[ -n "$port_arg" ] && export PP_PORT_API="$port_arg"

# Source pp_env.sh for defaults (respects exported vars)
if [ -f ./pp_env.sh ]; then
  source ./pp_env.sh
fi

# Final port/DB
port=${PP_PORT_API:-4001}
dbn=${PP_DATABASE:-EuroTourno}
param=${PP_API_APP:-${env}/mobile}

# PID lock
pidfile="./pids/${port}.pid"
mkdir -p ./pids
if [ -f "$pidfile" ]; then
  old_pid=$(cat "$pidfile")
  if kill -0 "$old_pid" 2>/dev/null; then
    echo -e "${RED}[ERROR]${RESET} Port $port running (PID $old_pid). Run 'make kill port=$port'"
    exit 1
  fi
  rm -f "$pidfile"
fi
echo $$ > "$pidfile"
trap "rm -f '$pidfile'" EXIT

# Trace/log
trace=$$
echo -e "${BLUE}[INIT]${RESET} Trace ID: $trace"
mkdir -p ./logs
logfile="./logs/server.log"
> "$logfile"
echo "$trace" > "./pids/start-$trace.pid"
echo "env=$env port=$port dbn=$dbn" >> "$pidfile"
echo "Run \`make follow\` to follow logs. Log: $logfile"

# Source pp_env.sh to display DB config
if [ -f ./pp_env.sh ]; then
  source ./pp_env.sh
fi
DB_HOST="${PP_HST:-N/A}"
DB_USER="${PP_USR:-N/A}"
DB_PASS="***"
DB_NAME="$dbn"

printf "${BLUE}[CONFIG]${RESET} General Settings Table:\n"
printf "%-20s | %-20s\n" "Setting" "Value"
printf "--------------------|--------------------\n"
printf "%-20s | %-20s\n" "Environment" "$env"
printf "%-20s | %-20s\n" "Port" "$port"
printf "%-20s | %-20s\n" "DB Host" "$DB_HOST"
printf "%-20s | %-20s\n" "DB User" "$DB_USER"
printf "%-20s | %-20s\n" "DB Name" "$DB_NAME"
printf "%-20s | %-20s\n" "DB Password" "$DB_PASS"
printf "%-20s | %-20s\n" "App" "$param"
printf "\n"
echo "env=$env" >> "$pidfile"
echo "port=$port" >> "$pidfile"
echo "dbn=$dbn" >> "$pidfile"
echo "Run \`make follow\` to follow the logs."
echo "Log file: $logfile"

pids=$(lsof -ti tcp:$port 2>/dev/null || true)
[ -n "$pids" ] && {
  echo -e "${YELLOW}[WARN]${RESET} Killing processes on port $port: $pids" | tee -a "$logfile"
  kill -9 $pids
  sleep 2
}
sleep 1
if lsof -i tcp:$port >/dev/null 2>&1; then
  echo -e "${RED}[ERROR]${RESET} Failed to free port $port." | tee -a "$logfile"
  exit 1
fi
echo -e "${GREEN}[SUCCESS]${RESET} Port $port free." | tee -a "$logfile"

# Build and launch single instance (PM2 for restarts/watch)
echo -e "${GREEN}[BUILD]${RESET} Compiling..." | tee -a "$logfile"
npm run build >> "$logfile" 2>&1 || { echo -e "${RED}[ERROR]${RESET} Build failed" | tee -a "$logfile"; exit 1; }

echo -e "${GREEN}[LAUNCH]${RESET} Starting on port $port at [$(date)]" | tee -a "$logfile"
PP_ENV="$env" PP_DATABASE="$dbn" PP_PORT_API="$port" PP_API_APP="$param" node dist/server.js >> "$logfile" 2>&1 &
server_pid=$!

trap "kill $server_pid 2>/dev/null || true" EXIT

wait $server_pid
