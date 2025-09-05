#!/bin/bash

npm run build

if [ -z "$1" ]; then
    read -p "Which environment? [production/acceptance]: " env
else
    env=$1
fi
port=${2:-4000}
if [ "$env" = "production" ]; then
    while true; do
        PP_DBN=EuroTourno ./scripts/start-server.sh $port production/mobile false EuroTourno || \
        (echo "Server crashed, restarting in 5 seconds..." && sleep 5);
    done
elif [ "$env" = "acceptance" ]; then
    while true; do
        PP_DBN=AccTourno ./scripts/start-server.sh $port acceptance/mobile false AccTourno || \
        (echo "Server crashed, restarting in 5 seconds..." && sleep 5);
    done
else
    echo "Invalid environment. Use 'production' or 'acceptance'";
    exit 1
fi
