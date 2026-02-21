#!/bin/bash

# Get port from .env default
set -a
source .env
set +a

# Check port and get final value
export PP_PORT_API=$(./scripts/make/check-port.sh)

# Source secrets
set -a
source .kamal/secrets.tst
set +a

# Set other env vars
export PP_HST=tst-data.lan
export PP_USR=$PP_USR_TST
export PP_PWD=$PP_PWD
export PP_DATABASE=$PP_DATABASE

# Run dev
echo "Starting dev server on port $PP_PORT_API..."
npm run dev
