#!/bin/bash

port=${PP_PORT_API:-4000}
export PP_ENV=mock
export PP_DATABASE=MockTourno
export PP_USE_MOCK=true
export PP_API_APP=mobile
mkdir -p ./logs
> ./logs/server.log
echo "Starting mock server on port $port. Log: ./logs/server.log"
./scripts/start-server.sh >> ./logs/server.log 2>&1
