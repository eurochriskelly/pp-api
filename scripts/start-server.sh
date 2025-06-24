#!/bin/bash
set -eo pipefail

# Configuration
SCRIPT_NAME=$(basename "$0")
LOG_BASE_DIR="./logs"
MAX_RESTARTS=5
RESTART_DELAY=5

# Validate environment
if [ -z "${PP_DBN:-}" ]; then
  echo "ERROR: PP_DBN environment variable must be set (EuroTourno or AccTourno)"
  exit 1
fi

# Parse arguments first to determine USE_MOCK
PORT=${1:-4000}
APP=${2:-mobile}
USE_MOCK=${3:-false}
DATABASE=${4:-${PP_DBN}}

if [ "$USE_MOCK" = "false" ]; then
  if [ ! -f "pp_env.sh" ]; then
    echo "ERROR: Required file pp_env.sh not found in current directory (and not in mock mode)"
    exit 1
  fi
fi

# Setup logging
LOG_DIR="${LOG_BASE_DIR}/${PP_DBN}"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/${TIMESTAMP}.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Log startup info
echo "=== Starting ${SCRIPT_NAME} at $(date) ==="
echo "Database: ${PP_DBN}"
echo "Port: ${PORT}"
echo "App: ${APP}"
echo "Use Mock: ${USE_MOCK}"
echo "Log File: ${LOG_FILE}"

# Main loop
RESTART_COUNT=0
while [ $RESTART_COUNT -le $MAX_RESTARTS ]; do
  echo "--- Starting server (attempt $((RESTART_COUNT+1)) ---"
  
  # Source environment variables first, if not in mock mode
  if [ "$USE_MOCK" = "false" ]; then
    echo "Sourcing pp_env.sh..."
    OLD_DB=$PP_DBN
    source pp_env.sh
    if [ -n "$OLD_DB" ];then
      PP_DBN=$OLD_DB
    fi
  else
    echo "Skipping pp_env.sh sourcing (mock mode)"
  fi
  
  # Print variables *after* sourcing (if applicable) and *before* starting node
  echo "--- Variables before starting Node.js ---"
  echo "PP_DBN: ${PP_DBN}"
  echo "PORT: ${PORT}"
  echo "APP: ${APP}"
  echo "USE_MOCK: ${USE_MOCK}"
  echo "DATABASE: ${DATABASE}"
  echo "-----------------------------------------"

  # Now start the server
  if node dist/server.js \
    --port="$PORT" \
    --app="$APP" \
    --use-mock="$USE_MOCK" \
    --database="$DATABASE"
  then
    echo "Server exited cleanly"
    break
  else
    EXIT_CODE=$?
    echo "Server crashed with exit code $EXIT_CODE"
    
    if [ $RESTART_COUNT -eq $MAX_RESTARTS ]; then
      echo "Max restarts reached (${MAX_RESTARTS}), giving up"
      exit $EXIT_CODE
    fi
    
    echo "Restarting in ${RESTART_DELAY} seconds..."
    sleep $RESTART_DELAY
    ((RESTART_COUNT++))
    
    # Rotate log file if restarting
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    LOG_FILE="${LOG_DIR}/${TIMESTAMP}.log"
    exec > >(tee -a "$LOG_FILE") 2>&1
  fi
done

echo "=== Server stopped at $(date) ==="
