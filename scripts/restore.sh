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
	echo "Error: ENV is required. Usage: make restore ENV=<environment> FILE=<path/to/file.sql>"
	exit 1
fi

# Validate FILE is provided
if [ -z "$FILE" ]; then
	echo "Error: FILE is required. Usage: make restore ENV=<environment> FILE=<path/to/file.sql>"
	exit 1
fi

# Validate backup file exists
if [ ! -f "$FILE" ]; then
	echo "Error: Backup file not found: $FILE"
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
# Use DATABASE if provided, otherwise fall back to PP_DATABASE
DB_NAME="${DATABASE:-$PP_DATABASE}"

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

echo "=========================================="
echo "WARNING: You are about to restore a database!"
echo "=========================================="
echo ""
echo "Environment: $ENV_UPPER"
echo "Database host: $DB_HOST"
echo "Database: $DB_NAME"
echo "Backup file: $FILE"

if [ "$DROP" = "true" ]; then
	echo ""
	echo "⚠️  DROP=true: Database will be DROPPED and recreated before restore!"
else
	echo ""
	echo "This will OVERWRITE all data in $DB_NAME on $DB_HOST"
fi

echo ""
echo 'Type "confirm" to proceed: '
read -r CONFIRMATION

if [ "$CONFIRMATION" != "confirm" ]; then
	echo "Restore cancelled."
	exit 1
fi

echo ""

# Handle DROP=true - drop database if it exists
if [ "$DROP" = "true" ]; then
	echo "Dropping database $DB_NAME..."
	echo "  Command: mysql --protocol=TCP --skip-ssl -h $DB_HOST -u $DB_USER -p*** -e \"DROP DATABASE IF EXISTS \`$DB_NAME\`;\""
	mysql --protocol=TCP --skip-ssl -h "$DB_HOST" -u "$DB_USER" -p"$DB_PWD" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" 2>/dev/null || true
	echo "Database dropped."

	# Clean up stale directory if it exists (DROP DATABASE sometimes leaves it behind)
	# Check if we're connecting to localhost/127.0.0.1 (Docker container)
	if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
		echo "Cleaning up stale directory for $DB_NAME..."
		echo "  Command: docker exec pp-infra-mysql-1 rm -rf /var/lib/mysql/$DB_NAME 2>/dev/null || true"
		docker exec pp-infra-mysql-1 rm -rf /var/lib/mysql/"$DB_NAME" 2>/dev/null || true
		echo "Stale directory removed."
	fi
fi

# Check if database exists, create if not
echo "Checking if database $DB_NAME exists..."
echo "  Command: mysql --protocol=TCP --skip-ssl -h $DB_HOST -u $DB_USER -p*** -e \"SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$DB_NAME';\""
DB_EXISTS=$(mysql --protocol=TCP --skip-ssl -h "$DB_HOST" -u "$DB_USER" -p"$DB_PWD" -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$DB_NAME';" 2>/dev/null | grep -c "$DB_NAME" || true)

if [ "$DB_EXISTS" -eq 0 ]; then
	echo "Database does not exist. Creating $DB_NAME..."
	echo "  Command: mysql --protocol=TCP --skip-ssl -h $DB_HOST -u $DB_USER -p*** -e \"CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
	mysql --protocol=TCP --skip-ssl -h "$DB_HOST" -u "$DB_USER" -p"$DB_PWD" -e "CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
	echo "Database created."
else
	echo "Database exists."
fi

echo "Restoring $DB_NAME from $FILE..."
echo "  Command: mysql --protocol=TCP --skip-ssl -h $DB_HOST -u $DB_USER -p*** $DB_NAME < $FILE"
mysql --protocol=TCP --skip-ssl -h "$DB_HOST" -u "$DB_USER" -p"$DB_PWD" "$DB_NAME" <"$FILE"

echo ""
echo "Restore completed successfully!"
