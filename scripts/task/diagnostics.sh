#!/bin/bash
set -euo pipefail

action=${1:-}
port=${2:-}

if [[ "$action" != "on" && "$action" != "off" ]]; then
  echo "Usage: task server:diagnostics ACTION=on|off PORT=NUMBER" >&2
  exit 1
fi

if [[ ! "$port" =~ ^[0-9]+$ ]]; then
  echo "PORT must be a number. Usage: task server:diagnostics ACTION=on|off PORT=NUMBER" >&2
  exit 1
fi

if [ "$action" = "on" ]; then
  curl -X PUT "http://localhost:${port}/api/system/diagnostics/print-sql-statements"
else
  curl -X DELETE "http://localhost:${port}/api/system/diagnostics/print-sql-statements"
fi
