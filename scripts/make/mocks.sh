#!/bin/bash

port=${1:-4000}
# Ensure logs directory exists
mkdir -p ./logs
# Truncate the log file
> ./logs/server.log
echo "Starting server in mock mode on port $port..."
echo "Logging to ./logs/server.log"
PP_DBN=MockTourno ./scripts/start-server.sh $port mobile true MockTourno >> ./logs/server.log 2>&1
