#!/bin/bash

# Set defaults
PORT=${1:-4010}
HOST=${2:-localhost}
PROTOCOL="http"

# Check if parameters were passed via npm
if [[ "$*" == *"--port"* ]]; then
    PORT=$(echo "$*" | grep -oP '(?<=--port=)[0-9]+')
fi

if [[ "$*" == *"--host"* ]]; then
    HOST=$(echo "$*" | grep -oP '(?<=--host=)[^ ]+')
fi

# If no API specified, run interactive mode
if [[ "$*" != *"--api"* ]]; then
    API=$(node scripts/api-helper.js)
else
    API=$(echo "$*" | grep -oP '(?<=--api=)[^ ]+')
fi

# Handle different API endpoints
case $API in
    nextup)
        if [[ "$*" != *"--tournamentId"* ]]; then
            read -p "Enter tournamentId: " TOURNAMENT_ID
        else
            TOURNAMENT_ID=$(echo "$*" | grep -oP '(?<=--tournamentId=)[0-9]+')
        fi
        
        echo -e "\nCalling API: ${PROTOCOL}://${HOST}:${PORT}/api/tournaments/${TOURNAMENT_ID}/fixtures/nextup"
        echo "Fetching next matches for tournament ID: ${TOURNAMENT_ID}"
        
        response=$(curl -s -w "\nHTTP Status: %{http_code}\n" "${PROTOCOL}://${HOST}:${PORT}/api/tournaments/${TOURNAMENT_ID}/fixtures/nextup")
        
        echo -e "\nResponse:"
        echo "$response"
        ;;
    *)
        echo "Unknown API endpoint"
        exit 1
        ;;
esac
