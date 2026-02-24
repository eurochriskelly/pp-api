#!/bin/bash
set -e

# Check MySQL client version (9.0+ removed mysql_native_password support)
# MariaDB uses different versioning (MariaDB 10.x+ is based on MySQL 8.0 and supports mysql_native_password)
if command -v mysql &>/dev/null; then
	MYSQL_FULL_VERSION=$(mysql --version 2>/dev/null)
	# Check if this is actually MySQL (not MariaDB)
	if echo "$MYSQL_FULL_VERSION" | grep -qi "MariaDB"; then
		# MariaDB is fine, it supports mysql_native_password
		: # no-op
	else
		# This is Oracle MySQL, check version
		MYSQL_VERSION=$(echo "$MYSQL_FULL_VERSION" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 | cut -d. -f1)
		if [ "$MYSQL_VERSION" -ge 9 ] 2>/dev/null; then
			echo "ERROR: MySQL client version 9.0+ detected"
			echo ""
			echo "Your MySQL client ($MYSQL_VERSION.x) removed support for 'mysql_native_password' authentication."
			echo "This is required to connect to older MySQL servers."
			echo ""
			echo "To fix this, install MariaDB client instead:"
			echo "  brew install mariadb"
			echo "  brew unlink mysql"
			echo "  brew link mariadb"
			echo ""
			echo "Or downgrade to MySQL 8.0:"
			echo "  brew install mysql@8.0"
			echo "  brew unlink mysql"
			echo "  brew link mysql@8.0"
			exit 1
		fi
	fi
fi

# Validate ENV is provided
if [ -z "$ENV" ]; then
	echo "Error: ENV is required. Usage: make backup ENV=<environment>"
	exit 1
fi

# Normalize ENV to uppercase for variable lookup
ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')
ENV_LOWER=$(echo "$ENV" | tr '[:upper:]' '[:lower:]')

# Switch to top git folder
cd "$(git rev-parse --show-toplevel)"

# Source .env file
if [ ! -f "./.env" ]; then
	echo "Error: .env file not found"
	exit 1
fi
set -a
source ./.env
set +a

# Source .env.local file if it exists (overrides .env)
if [ -f "./.env.local" ]; then
	set -a
	source ./.env.local
	set +a
fi

# Source secrets file
SECRETS_FILE="./.kamal/secrets.${ENV_LOWER}"
if [ ! -f "$SECRETS_FILE" ]; then
	echo "Error: Secrets file not found: $SECRETS_FILE"
	exit 1
fi
set -a
source "$SECRETS_FILE"
set +a

# Get environment-specific variables dynamically
HOSTNAME_VAR="PP_HOSTNAME_DB_${ENV_UPPER}"
USER_VAR="PP_USR_${ENV_UPPER}"

DB_HOST="${!HOSTNAME_VAR}"
DB_USER="${!USER_VAR}"
DB_PWD="$PP_PWD"
DB_NAME="$PP_DATABASE"

# Validate required variables
if [ -z "$DB_HOST" ]; then
	echo "Error: ${HOSTNAME_VAR} is not defined in .env"
	exit 1
fi

if [ -z "$DB_USER" ]; then
	echo "Error: ${USER_VAR} is not defined in .env"
	exit 1
fi

if [ -z "$DB_PWD" ]; then
	echo "Error: PP_PWD is not defined in ${SECRETS_FILE}"
	exit 1
fi

if [ -z "$DB_NAME" ]; then
	echo "Error: PP_DATABASE is not defined in .env"
	exit 1
fi

# Create backup directory
today=$(date +"%Y%m%dT%H%M")
bkpdir="backups/${today}"
mkdir -p "$bkpdir"

echo "Backing up environment: $ENV_UPPER"
echo "Database host: $DB_HOST"
echo "Backup directory: $bkpdir"
echo ""

# Function to backup a single database
backup_database() {
	local db="$1"
	local output_file="${bkpdir}/${ENV_LOWER}-${db}-${today}.sql"

	echo "Backing up database: $db"
	# Use --protocol=TCP to force TCP connection and avoid socket issues
	# Use --skip-ssl to bypass self-signed certificate errors
	mysqldump --protocol=TCP --skip-ssl -h "$DB_HOST" -u "$DB_USER" -p"$DB_PWD" "$db" >"$output_file"
	echo "  -> $output_file"
}

# Backup standard database
backup_database "$DB_NAME"

# Backup extra databases if defined
if [ -n "$PP_DATABASES_EXTRA" ]; then
	IFS=',' read -ra EXTRA_DBS <<<"$PP_DATABASES_EXTRA"
	for db in "${EXTRA_DBS[@]}"; do
		# Trim whitespace
		db=$(echo "$db" | tr -d '[:space:]')
		if [ -n "$db" ]; then
			backup_database "$db"
		fi
	done
fi

echo ""
echo "Backups completed in $bkpdir"
