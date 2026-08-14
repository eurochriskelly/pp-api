#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "Running automated API tests..."

if [ -z "${SUITE:-}" ]; then
  case "${STORY:-tournament-day}" in
    tournament-day|tournament)
      SUITE=suites/tournament-day.txt
      ;;
    pre-tournament|pre-tournament-admin)
      SUITE=suites/pre-tournament-admin.txt
      ;;
    championships|series)
      SUITE=suites/championships.txt
      ;;
    *)
      echo "Unknown STORY: ${STORY}. Use tournament-day, pre-tournament, or championships." >&2
      exit 1
      ;;
  esac
fi

export SUITE
echo "Using suite: ${SUITE}"
node scripts/run-api-automated-tests.js
