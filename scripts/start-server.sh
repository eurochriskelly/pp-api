#!/bin/bash
set -eo pipefail

# Configuration
SCRIPT_NAME=$(basename "$0")
LOG_BASE_DIR="./logs"

# Validate environment
if [ -z "${PP_DBN:-}" ]; then
  echo "ERROR: PP_DBN environment variable must be set (EuroTourno or AccTourno)"
  exit 1
fi

# Single launch with a dedicated log file.
PORT=${PP_PORT_API:-4000}
APP=${PP_API_APP:-mobile}
DATABASE=${PP_DATABASE:-EuroTourno}

# Port check
if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  echo "ERROR: Port $PORT in use."
  exit 1
fi

# Setup logging
LOG_DIR="${LOG_BASE_DIR}/${PP_DBN}"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/${TIMESTAMP}.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Log startup info
echo "=== Starting ${SCRIPT_NAME} at $(date) ==="
echo "Database: ${PP_DBN:-$DATABASE}"
echo "Port: ${PORT}"
echo "App: ${APP}"
echo "Use Mock: ${USE_MOCK}"
echo "Log File: ${LOG_FILE}"

echo "--- Variables before starting Node.js ---"
echo "PP_DBN: ${PP_DBN}"
echo "PORT: ${PORT}"
echo "APP: ${APP}"
echo "USE_MOCK: ${USE_MOCK:-false}"
echo "DATABASE: ${DATABASE}"
echo "-----------------------------------------"

exec node dist/src/server.js
