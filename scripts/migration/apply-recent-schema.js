#!/usr/bin/env node

/*
 * Applies the schema required by invite registration, competition-level rounds,
 * and normalized fixture outcomes. It is deliberately dry-run by default.
 *
 * This runner is safe to rerun: every schema operation is guarded by an
 * information_schema check and the data changes are idempotent. MySQL DDL is
 * not transactional, so a failed run must be rerun after fixing its cause.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..', '..');
const args = new Set(process.argv.slice(2));
const envArg = process.argv.find((arg) => arg.startsWith('--env='));
const requestedEnv = envArg
  ? envArg.slice('--env='.length).toLowerCase()
  : 'dev';
const environmentAliases = {
  dev: 'DEV',
  development: 'DEV',
  tst: 'TST',
  test: 'TST',
  acceptance: 'TST',
  acc: 'TST',
  production: 'PRD',
  prod: 'PRD',
  prd: 'PRD',
};
const environment = environmentAliases[requestedEnv];
const wetRun = args.has('--wet');

if (!environment) {
  throw new Error(
    `Unknown environment "${requestedEnv}". Use dev, acceptance, or production.`
  );
}

if (environment === 'PRD' && wetRun && !args.has('--confirm-production')) {
  throw new Error('Production requires both --wet and --confirm-production.');
}

require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({
  path: path.join(root, '.env.local'),
  override: true,
});

const secretsFile = path.join(
  root,
  '.kamal',
  `secrets.${environment.toLowerCase()}`
);
if (fs.existsSync(secretsFile)) {
  require('dotenv').config({ path: secretsFile, override: true });
}

const config = {
  host:
    process.env[`PP_HOSTNAME_DB_${environment}`] ||
    process.env[`PP_HST_${environment}`],
  user: process.env[`PP_USR_${environment}`] || process.env.PP_USR,
  password: process.env.PP_PWD,
  database: process.env.PP_DATABASE,
};

for (const [key, value] of Object.entries(config)) {
  if (!value) throw new Error(`Missing database configuration: ${key}`);
}

const migrationIds = {
  inviteRegistration: '20261002_invite_registration',
  championshipCompetitionRounds: '20261002_championship_competition_rounds',
  normalizedFixtureOutcomes: '20261002_normalize_fixture_outcomes',
};

const quoteIdentifier = (value) => `\`${value.replaceAll('`', '``')}\``;

async function getRows(connection, sql, values = []) {
  const [rows] = await connection.query(sql, values);
  return rows;
}

async function table(connection, tableName) {
  const rows = await getRows(
    connection,
    `SELECT ENGINE AS engine
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return rows[0];
}

async function column(connection, tableName, columnName) {
  const rows = await getRows(
    connection,
    `SELECT column_type AS columnType
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return rows[0];
}

async function indexExists(connection, tableName, indexName) {
  const rows = await getRows(
    connection,
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [tableName, indexName]
  );
  return Boolean(rows[0]);
}

async function foreignKeyExists(connection, tableName, constraintName) {
  const rows = await getRows(
    connection,
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?
       AND constraint_type = 'FOREIGN KEY' LIMIT 1`,
    [tableName, constraintName]
  );
  return Boolean(rows[0]);
}

async function requireInnoDb(connection, tableName) {
  const existingTable = await table(connection, tableName);
  if (!existingTable)
    throw new Error(`Required table ${tableName} does not exist.`);
  if (String(existingTable.engine).toLowerCase() !== 'innodb') {
    throw new Error(
      `Required table ${tableName} must use InnoDB (found ${existingTable.engine}).`
    );
  }
}

async function requireCompatibleIntegerIds(connection, tableNames) {
  const types = [];
  for (const [tableName, columnName] of tableNames) {
    const existingColumn = await column(connection, tableName, columnName);
    if (!existingColumn)
      throw new Error(
        `Required column ${tableName}.${columnName} does not exist.`
      );
    types.push(existingColumn.columnType.toLowerCase());
  }
  if (
    !types.every((type) =>
      /^(tiny|small|medium|big)?int(\(\d+\))?( unsigned)?$/.test(type)
    )
  ) {
    throw new Error(
      `Foreign-key columns must be integer types; found ${types.join(', ')}.`
    );
  }
  if (new Set(types).size !== 1) {
    throw new Error(
      `Foreign-key column types must match exactly; found ${types.join(', ')}.`
    );
  }
  return types[0];
}

async function addColumnIfMissing(
  connection,
  tableName,
  columnName,
  definition
) {
  if (await column(connection, tableName, columnName)) return false;
  await connection.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(columnName)} ${definition}`
  );
  return true;
}

async function addIndexIfMissing(connection, tableName, indexName, definition) {
  if (await indexExists(connection, tableName, indexName)) return false;
  await connection.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD ${definition}`
  );
  return true;
}

async function addForeignKeyIfMissing(
  connection,
  tableName,
  constraintName,
  definition
) {
  if (await foreignKeyExists(connection, tableName, constraintName))
    return false;
  await connection.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(constraintName)} ${definition}`
  );
  return true;
}

async function ensureMigrationLedger(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) NOT NULL,
      appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function recordMigration(connection, migrationId) {
  await connection.query(
    'INSERT IGNORE INTO schema_migrations (id) VALUES (?)',
    [migrationId]
  );
}

async function preflight(connection) {
  const version = await getRows(connection, 'SELECT VERSION() AS version');
  console.log(`[migration] Server version: ${version[0].version}`);

  for (const tableName of [
    'sec_users',
    'clubs',
    'fixtures',
    'tournaments',
    'championships',
  ]) {
    await requireInnoDb(connection, tableName);
  }

  await requireCompatibleIntegerIds(connection, [['clubs', 'clubId']]);
  await requireCompatibleIntegerIds(connection, [['tournaments', 'id']]);
  await requireCompatibleIntegerIds(connection, [['championships', 'id']]);

  const fixtureOutcome = await column(connection, 'fixtures', 'outcome');
  if (!fixtureOutcome)
    throw new Error('Required column fixtures.outcome does not exist.');

  const unknownOutcomes = await getRows(
    connection,
    `SELECT outcome, COUNT(*) AS count
     FROM fixtures
     WHERE outcome IS NOT NULL
       AND outcome NOT IN ('played', 'in-progress', 'not played', 'skipped', 'conceded', 'forfeit')
     GROUP BY outcome`
  );
  if (unknownOutcomes.length) {
    throw new Error(
      `Unexpected fixture outcomes: ${unknownOutcomes.map((row) => row.outcome).join(', ')}.`
    );
  }

  if (await column(connection, 'sec_users', 'PhoneNumber')) {
    const duplicatePhones = await getRows(
      connection,
      `SELECT PhoneNumber FROM sec_users
       WHERE PhoneNumber IS NOT NULL AND PhoneNumber != ''
       GROUP BY PhoneNumber HAVING COUNT(*) > 1 LIMIT 1`
    );
    if (duplicatePhones.length)
      throw new Error(
        'Cannot add phone uniqueness: duplicate phone numbers exist.'
      );
  }
}

async function applyInviteRegistration(connection) {
  const clubIdType = await requireCompatibleIntegerIds(connection, [
    ['clubs', 'clubId'],
  ]);
  await addColumnIfMissing(
    connection,
    'sec_users',
    'PhoneNumber',
    'VARCHAR(30) DEFAULT NULL'
  );
  await addColumnIfMissing(
    connection,
    'sec_users',
    'club_id',
    `${clubIdType.toUpperCase()} DEFAULT NULL`
  );
  await addColumnIfMissing(
    connection,
    'sec_users',
    'Verified',
    'TINYINT(1) NOT NULL DEFAULT 0'
  );
  await addColumnIfMissing(
    connection,
    'sec_users',
    'ManualVerificationRequired',
    'TINYINT(1) NOT NULL DEFAULT 0'
  );
  await addColumnIfMissing(
    connection,
    'sec_users',
    'LoginCodeHash',
    'VARCHAR(100) DEFAULT NULL'
  );
  await addColumnIfMissing(
    connection,
    'sec_users',
    'InviteTokenHash',
    'VARCHAR(128) DEFAULT NULL'
  );
  await addColumnIfMissing(
    connection,
    'sec_users',
    'InviteExpiresAt',
    'DATETIME DEFAULT NULL'
  );
  await addIndexIfMissing(
    connection,
    'sec_users',
    'ux_sec_users_phone',
    'UNIQUE KEY `ux_sec_users_phone` (`PhoneNumber`)'
  );
  await addIndexIfMissing(
    connection,
    'sec_users',
    'ix_sec_users_invite_token',
    'KEY `ix_sec_users_invite_token` (`InviteTokenHash`)'
  );
  await addForeignKeyIfMissing(
    connection,
    'sec_users',
    'fk_sec_users_club',
    'FOREIGN KEY (`club_id`) REFERENCES `clubs` (`clubId`)'
  );
  await recordMigration(connection, migrationIds.inviteRegistration);
}

async function applyChampionshipCompetitionRounds(connection) {
  const tournamentIdType = await requireCompatibleIntegerIds(connection, [
    ['tournaments', 'id'],
  ]);
  const championshipIdType = await requireCompatibleIntegerIds(connection, [
    ['championships', 'id'],
  ]);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tournament_competitions (
      id ${tournamentIdType.toUpperCase()} NOT NULL AUTO_INCREMENT,
      tournamentId ${tournamentIdType.toUpperCase()} NOT NULL,
      name VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_tournament_competition_name (tournamentId, name),
      CONSTRAINT fk_tournament_competitions_tournament
        FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    INSERT IGNORE INTO tournament_competitions (tournamentId, name)
    SELECT tournamentId, TRIM(category) FROM fixtures
    WHERE tournamentId IS NOT NULL AND NULLIF(TRIM(category), '') IS NOT NULL
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS championship_competition_rounds (
      id ${championshipIdType.toUpperCase()} NOT NULL AUTO_INCREMENT,
      championshipId ${championshipIdType.toUpperCase()} NOT NULL,
      roundNumber INT NOT NULL,
      tournamentId ${tournamentIdType.toUpperCase()} NOT NULL,
      competition VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_championship_competition_round
        (championshipId, roundNumber, tournamentId, competition),
      UNIQUE KEY uk_tournament_competition_championship_round
        (tournamentId, competition),
      KEY ix_championship_competition_rounds_championship (championshipId),
      CONSTRAINT fk_championship_competition_rounds_championship
        FOREIGN KEY (championshipId) REFERENCES championships(id) ON DELETE CASCADE,
      CONSTRAINT fk_championship_competition_rounds_tournament
        FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await recordMigration(connection, migrationIds.championshipCompetitionRounds);
}

async function applyNormalizedFixtureOutcomes(connection) {
  await connection.query(`
    ALTER TABLE fixtures
    MODIFY outcome ENUM('played', 'in-progress', 'not played', 'skipped', 'conceded', 'forfeit')
      NULL DEFAULT 'not played'
  `);
  await connection.query(`
    UPDATE fixtures
    SET outcome = CASE
      WHEN outcome IN ('conceded', 'forfeit') THEN 'skipped'
      WHEN outcome IS NULL
        AND goals1 IS NOT NULL AND points1 IS NOT NULL
        AND goals2 IS NOT NULL AND points2 IS NOT NULL THEN 'played'
      ELSE 'not played'
    END
    WHERE outcome IS NULL OR outcome IN ('conceded', 'forfeit')
  `);
  await connection.query(`
    ALTER TABLE fixtures
    MODIFY outcome ENUM('played', 'in-progress', 'not played', 'skipped')
      NOT NULL DEFAULT 'not played'
  `);
  await recordMigration(connection, migrationIds.normalizedFixtureOutcomes);
}

async function run() {
  console.log(
    `[migration] Target: ${requestedEnv} (${config.host}/${config.database})`
  );
  if (!wetRun) {
    console.log(
      '[migration] Dry-run only: validating prerequisites; no schema or data will change.'
    );
  }

  const connection = await mysql.createConnection(config);
  try {
    await connection.query('SET SESSION lock_wait_timeout = 5');
    await preflight(connection);
    if (!wetRun) return;

    const [lockRows] = await connection.query(
      "SELECT GET_LOCK('pp-api-recent-schema-migration', 5) AS acquired"
    );
    if (!lockRows[0].acquired)
      throw new Error('Another schema migration is already running.');
    try {
      await ensureMigrationLedger(connection);
      await applyInviteRegistration(connection);
      await applyChampionshipCompetitionRounds(connection);
      await applyNormalizedFixtureOutcomes(connection);
      console.log(
        '[migration] Completed successfully. Verify the post-deployment checks in docs/runbooks/recent-schema-migration.md.'
      );
    } finally {
      await connection.query(
        "DO RELEASE_LOCK('pp-api-recent-schema-migration')"
      );
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(`[migration] Failed: ${error.message}`);
  process.exitCode = 1;
});
