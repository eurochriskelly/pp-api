#!/bin/bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Load local env defaults if present (does not override already exported vars)
if [ -f "./.env" ]; then
  set -a
  source ./.env
  set +a
fi

if [ -f "./.env.local" ]; then
  set -a
  source ./.env.local
  set +a
fi

DB_HOST="${PP_HOST:-${PP_HST:-}}"
DB_USER="${PP_USR:-root}"
DB_PWD="${PP_PWD:-}"
DB_NAME="${DATABASE:-${PP_DATABASE:-}}"

if [ -z "$DB_HOST" ]; then
  echo "Error: PP_HOST is required (or PP_HST fallback)."
  exit 1
fi

if [ -z "$DB_PWD" ]; then
  echo "Error: PP_PWD is required."
  exit 1
fi

if [ -z "$DB_NAME" ]; then
  echo "Error: PP_DATABASE (or DATABASE) is required."
  exit 1
fi

echo "Running championship migration on $DB_HOST/$DB_NAME as $DB_USER"

MYSQL_BASE=(mysql --protocol=TCP --skip-ssl -h "$DB_HOST" -u "$DB_USER" -p"$DB_PWD")

"${MYSQL_BASE[@]}" -e "SELECT 1" >/dev/null

"${MYSQL_BASE[@]}" "$DB_NAME" <<'SQL'
SET FOREIGN_KEY_CHECKS = 1;

-- 1.2 Rulesets Table (created before series to satisfy FK)
CREATE TABLE IF NOT EXISTS rulesets (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  configVersion VARCHAR(32) NOT NULL DEFAULT '1.0',
  config JSON NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 1.1 Series Table
CREATE TABLE IF NOT EXISTS series (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sport VARCHAR(50),
  defaultSquadSize INT NOT NULL DEFAULT 15,
  defaultPlayersPerTeam INT NOT NULL DEFAULT 15,
  rulesetId INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_series_status (status),
  KEY ix_series_ruleset (rulesetId),
  CONSTRAINT fk_series_ruleset
    FOREIGN KEY (rulesetId) REFERENCES rulesets(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- 1.3 Championships Table
CREATE TABLE IF NOT EXISTS championships (
  id INT NOT NULL AUTO_INCREMENT,
  seriesId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  year YEAR NOT NULL,
  numRounds INT NOT NULL DEFAULT 4,
  squadSize INT,
  playersPerTeam INT,
  status ENUM('draft', 'open', 'in-progress', 'completed', 'archived') DEFAULT 'draft',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_championships_series (seriesId),
  KEY ix_championships_year (year),
  KEY ix_championships_status (status),
  UNIQUE KEY uk_championships_series_year_name (seriesId, year, name),
  CONSTRAINT fk_championships_series
    FOREIGN KEY (seriesId) REFERENCES series(id)
) ENGINE=InnoDB;

-- 1.4 Championship Entrants Table
CREATE TABLE IF NOT EXISTS championship_entrants (
  id INT NOT NULL AUTO_INCREMENT,
  championshipId INT NOT NULL,
  entrantType ENUM('club', 'amalgamation') NOT NULL,
  clubId INT NULL,
  displayName VARCHAR(255) NOT NULL,
  status ENUM('registered', 'withdrawn', 'active') DEFAULT 'registered',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_entrants_championship (championshipId),
  KEY ix_entrants_club (clubId),
  UNIQUE KEY uk_entrants_championship_club (championshipId, clubId),
  CONSTRAINT fk_entrants_championship
    FOREIGN KEY (championshipId) REFERENCES championships(id) ON DELETE CASCADE,
  CONSTRAINT fk_entrants_club
    FOREIGN KEY (clubId) REFERENCES clubs(clubId)
) ENGINE=InnoDB;

-- 1.5 Amalgamation Clubs Table
CREATE TABLE IF NOT EXISTS amalgamation_clubs (
  id INT NOT NULL AUTO_INCREMENT,
  entrantId INT NOT NULL,
  clubId INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_amalgamation_club (entrantId, clubId),
  CONSTRAINT fk_amalgamation_entrant
    FOREIGN KEY (entrantId) REFERENCES championship_entrants(id) ON DELETE CASCADE,
  CONSTRAINT fk_amalgamation_club
    FOREIGN KEY (clubId) REFERENCES clubs(clubId)
) ENGINE=InnoDB;

-- 1.7 Tournament Teams Table
CREATE TABLE IF NOT EXISTS tournament_teams (
  id INT NOT NULL AUTO_INCREMENT,
  tournamentId INT NOT NULL,
  entrantId INT NOT NULL,
  teamName VARCHAR(255) NOT NULL,
  teamType ENUM('primary', 'secondary', 'combination') NOT NULL DEFAULT 'primary',
  squadSizeSubmitted INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_tournament_teams_tournament (tournamentId),
  KEY ix_tournament_teams_entrant (entrantId),
  UNIQUE KEY uk_tournament_teams_name (tournamentId, teamName),
  CONSTRAINT fk_tt_tournament
    FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_entrant
    FOREIGN KEY (entrantId) REFERENCES championship_entrants(id)
) ENGINE=InnoDB;

-- 1.8 Team Entrants Junction Table
CREATE TABLE IF NOT EXISTS team_entrants (
  id INT NOT NULL AUTO_INCREMENT,
  tournamentTeamId INT NOT NULL,
  entrantId INT NOT NULL,
  numPlayers INT,
  PRIMARY KEY (id),
  UNIQUE KEY uk_team_entrant (tournamentTeamId, entrantId),
  CONSTRAINT fk_team_entrants_team
    FOREIGN KEY (tournamentTeamId) REFERENCES tournament_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_entrants_entrant
    FOREIGN KEY (entrantId) REFERENCES championship_entrants(id)
) ENGINE=InnoDB;

-- 1.6 Modify Tournaments Table (idempotent)
SET @has_col_championshipId := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournaments'
    AND COLUMN_NAME = 'championshipId'
);
SET @sql := IF(
  @has_col_championshipId = 0,
  'ALTER TABLE tournaments ADD COLUMN championshipId INT NULL AFTER id',
  'SELECT "tournaments.championshipId already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col_roundNumber := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournaments'
    AND COLUMN_NAME = 'roundNumber'
);
SET @sql := IF(
  @has_col_roundNumber = 0,
  'ALTER TABLE tournaments ADD COLUMN roundNumber INT NULL AFTER championshipId',
  'SELECT "tournaments.roundNumber already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_tournaments_championship := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournaments'
    AND INDEX_NAME = 'ix_tournaments_championship'
);
SET @sql := IF(
  @has_idx_tournaments_championship = 0,
  'ALTER TABLE tournaments ADD KEY ix_tournaments_championship (championshipId)',
  'SELECT "ix_tournaments_championship already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_tournaments_championship := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournaments'
    AND CONSTRAINT_NAME = 'fk_tournaments_championship'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @has_fk_tournaments_championship = 0,
  'ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_championship FOREIGN KEY (championshipId) REFERENCES championships(id) ON DELETE SET NULL',
  'SELECT "fk_tournaments_championship already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SQL

echo "Championship migration completed successfully."
