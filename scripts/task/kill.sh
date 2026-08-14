#!/bin/bash

set -u

port="${1:-}"

stop_pidfile() {
  local pidfile="$1"
  local pid

  [ -f "$pidfile" ] || return 0
  pid=$(head -n 1 "$pidfile")
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    rm -f "$pidfile"
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping server process $pid..."
    kill -TERM "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "Server did not stop gracefully; terminating process $pid."
      kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pidfile"
}

if [ -n "$port" ]; then
  pidfile="./pids/${port}.pid"
  if [ ! -f "$pidfile" ]; then
    echo "No tracked server found for port $port. Refusing to stop untracked processes."
    exit 0
  fi
  stop_pidfile "$pidfile"
  rm -f "./pids/start-"*.pid
  echo "Stopped tracked server on port $port."
  exit 0
fi

# Colors
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${BLUE}[KILL]${RESET} Finding running server instances..."

mkdir -p ./pids

# Find all port pid files created by server:start.
shopt -s nullglob
pid_files=(./pids/[0-9]*.pid)

if [ ${#pid_files[@]} -eq 0 ]; then
  echo -e "${YELLOW}[INFO]${RESET} No tracked server instances found."
  exit 0
fi

for pid_file in "${pid_files[@]}"; do
  stop_pidfile "$pid_file"
done
rm -f ./pids/start-*.pid
echo -e "${GREEN}[DONE]${RESET} Tracked server instances stopped."
