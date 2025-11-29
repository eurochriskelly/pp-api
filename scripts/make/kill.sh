#!/bin/bash

port="$1"
if [ -n "$port" ]; then
  mkdir -p ./pids
  pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  rm -f ./pids/$port.*
  echo "Killed port $port (PIDs: $pids)"
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

# Find all pid files
pid_files=(./pids/start-*.pid)

if [ ${#pid_files[@]} -eq 0 ] || [ "${pid_files[0]}" = "./pids/start-*.pid" ]; then
    echo -e "${YELLOW}[INFO]${RESET} No running instances found."
    exit 0
fi

# Array to hold active processes
declare -a active_pids
declare -a active_info

for pid_file in "${pid_files[@]}"; do
    pid=$(head -n 1 "$pid_file")
    if kill -0 $pid 2>/dev/null; then
        env=$(grep '^env=' "$pid_file" | cut -d= -f2)
        port=$(grep '^port=' "$pid_file" | cut -d= -f2)
        dbn=$(grep '^dbn=' "$pid_file" | cut -d= -f2)
        active_pids+=("$pid")
        active_info+=("PID: $pid, Env: $env, Port: $port, DB: $dbn")
    else
        rm -f "$pid_file"
    fi
done

if [ ${#active_pids[@]} -eq 0 ]; then
    echo -e "${YELLOW}[INFO]${RESET} No active running instances found."
    exit 0
fi

echo -e "${GREEN}[INSTANCES]${RESET} Active running instances:"
for i in "${!active_info[@]}"; do
    echo "$((i+1)): ${active_info[$i]}"
done

echo ""
read -p "Enter numbers to kill (comma separated), 'all', or 'q' to quit: " input

if [ "$input" = "q" ]; then
    exit 0
elif [ "$input" = "all" ]; then
    to_kill=("${active_pids[@]}")
else
    IFS=',' read -ra selected <<< "$input"
    to_kill=()
    for s in "${selected[@]}"; do
        s=$(echo $s | tr -d ' ')
        if [[ $s =~ ^[0-9]+$ ]] && [ $s -ge 1 ] && [ $s -le ${#active_pids[@]} ]; then
            to_kill+=("${active_pids[$((s-1))]}")
        fi
    done
fi

for pid in "${to_kill[@]}"; do
    echo -e "${RED}[KILL]${RESET} Killing process $pid..."
    kill $pid
    pid_file="./pids/start-$pid.pid"
    rm -f "$pid_file"
done

echo -e "${GREEN}[DONE]${RESET} Selected instances killed."
