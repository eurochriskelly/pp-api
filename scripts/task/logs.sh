#!/bin/bash

if [ -z "$1" ]; then
    read -p "Which environment? [production/acceptance]: " env
else
    env=$1
fi
if [ "$env" = "production" ]; then
    latest=$(ls -t ./logs/EuroTourno/*.log | head -n 1);
    tail -f "$latest"
elif [ "$env" = "acceptance" ]; then
    latest=$(ls -t ./logs/AccTourno/*.log | head -n 1);
    tail -f "$latest"
else
    echo "Invalid environment. Use 'production' or 'acceptance'";
    exit 1
fi
