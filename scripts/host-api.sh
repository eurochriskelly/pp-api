#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Generate API documentation from source code
echo "Generating API documentation..."
cd "$PROJECT_ROOT"
node scripts/generate-api-docs.js

# Check if docs/api directory exists
if [ ! -d "docs/api" ]; then
  echo "docs/api directory not found. Exiting!"
  exit 1
fi

cd docs/api

if [ ! -f "openapi.yaml" ];then
  echo "No openapi.yaml found after generation. Exiting!"
  exit 1
fi

npx @redocly/cli@1.0.0 bundle openapi.yaml -o openapi_bundle.yaml

if [ ! -f "openapi_bundle.yaml" ];then
  echo "Something went wrong. Could not bundle openai yaml. Check spec!"
  ls
  exit 1
fi

npx @redocly/cli@1.0.0 build-docs openapi_bundle.yaml 

if [ ! -f "redoc-static.html" ];then
  echo "Something went wrong. Could not build static api docs. Check spec!"
  ls
  exit 1  
fi

mv redoc-static.html index.html
httpster -p 4444
