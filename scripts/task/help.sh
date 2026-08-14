#!/bin/bash

# Task may buffer helper output, so do not rely on stdout being a TTY here.
# Set PLAIN=1 for plain output in CI or when piping the help text.
if [ "${PLAIN:-}" != '1' ]; then
  RESET=$'\033[0m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  CYAN=$'\033[36m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
else
  RESET=''
  BOLD=''
  DIM=''
  CYAN=''
  GREEN=''
  YELLOW=''
fi

section() {
  printf '\n%s%s%s\n' "$BOLD$CYAN" "$1" "$RESET"
}

entry() {
  printf '  %s%-28s%s %s%-48s%s %s%s%s\n' \
    "$GREEN" "$1" "$RESET" "$YELLOW" "$2" "$RESET" "$DIM" "$3" "$RESET"
}

printf '%s%sUsage:%s %stask <command>%s %s[VARIABLE=value]%s\n' \
  "$BOLD" "$CYAN" "$RESET" "$GREEN" "$RESET" "$YELLOW" "$RESET"

section 'Development'
entry 'task server:dev' '' 'Start the development server against tst-data.lan'
entry 'task server:mock' 'PORT=4000' 'Start with mock services'
entry 'task server:start' 'ENV=acceptance PORT=4000 [FORCE=true]' 'Start a tracked server instance'
entry 'task server:logs' 'ENV=production|acceptance' 'Tail application logs'
entry 'task server:follow' '' 'Follow the local server log'
entry 'task server:stop' '[PORT=4000]' 'Stop tracked application instances'
entry 'task server:diagnostics' 'ACTION=on|off PORT=4000' 'Toggle SQL statement logging'

section 'Testing'
entry 'task test' '' 'Run unit and contract tests'
entry 'task test:unit' '' 'Run unit tests'
entry 'task test:contract' '' 'Run API contract tests'
entry 'task test:api' 'STORY=... CLEANUP=true' 'Run an automated API story'

section 'Database'
entry 'task db:backup' 'ENV=production' 'Create a database backup'
entry 'task db:restore' 'ENV=acceptance FILE=... [DROP=true]' 'Restore a database backup'

section 'Maintenance'
entry 'task build' '' 'Compile the TypeScript application'
entry 'task lint' '' 'Check code style'
entry 'task lint:fix' '' 'Fix code style issues'
entry 'task clean' '' 'Remove generated cache files'

printf '\n%sRun%s %stask --list%s for the Taskfile descriptions. Set %sPLAIN=1%s for plain output.\n' \
  "$DIM" "$RESET" "$GREEN" "$RESET" "$YELLOW" "$RESET"
