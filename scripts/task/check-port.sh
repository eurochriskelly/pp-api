#!/bin/bash

# Colors
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

# Get port from env or default
source .env 2>/dev/null || true
port=${PP_PORT_API:-4001}

# Check if port is in use
if lsof -i tcp:$port >/dev/null 2>&1; then
	next_port=$((port + 1))

	echo -e "${YELLOW}[WARN]${RESET} Port $port is already in use" >&2

	# Get process info
	pid=$(lsof -ti tcp:$port 2>/dev/null | head -1)
	if [ -n "$pid" ]; then
		cmd=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
		echo -e "${YELLOW}[INFO]${RESET} Process using port: $cmd (PID: $pid)" >&2
	fi

	echo "" >&2
	read -p "Port in use [k]ill and proceed or start on [n]ext port $next_port? " choice

	case "$choice" in
	[kK])
		echo -e "${BLUE}[ACTION]${RESET} Killing process on port $port..." >&2
		if [ -n "$pid" ]; then
			kill -9 $pid 2>/dev/null || true
			sleep 1
		fi
		# Double check
		if lsof -i tcp:$port >/dev/null 2>&1; then
			echo -e "${RED}[ERROR]${RESET} Failed to free port $port" >&2
			exit 1
		fi
		echo -e "${GREEN}[SUCCESS]${RESET} Port $port is now free" >&2
		;;
	[nN])
		echo -e "${BLUE}[ACTION]${RESET} Using next port: $next_port" >&2
		port=$next_port
		;;
	*)
		echo -e "${RED}[ERROR]${RESET} Invalid choice. Exiting." >&2
		exit 1
		;;
	esac
fi

# Output only the final port to stdout
echo $port
