#!/bin/bash

# Quick test for the system mode endpoint

echo "Testing system mode endpoint..."
curl -s http://localhost:4001/api/system/mode | python3 -m json.tool 2>/dev/null || echo "Server not running or endpoint not available"

echo ""
echo "You can also test with:"
echo "  curl http://localhost:4001/api/system/mode"
