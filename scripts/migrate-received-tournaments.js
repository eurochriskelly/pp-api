#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Parse --env argument BEFORE loading dotenv
const parseEnvArg = () => {
  const envIndex = process.argv.findIndex(
    (arg) => arg === '--env' || arg.startsWith('--env=')
  );
  if (envIndex === -1) return 'DEV';

  const arg = process.argv[envIndex];
  if (arg.startsWith('--env=')) {
    return arg.split('=')[1].toUpperCase();
  }
  return process.argv[envIndex + 1]?.toUpperCase() || 'DEV';
};

const env = parseEnvArg();
const secretsFile = path.join(
  __dirname,
  '..',
  '.kamal',
  `secrets.${env.toLowerCase()}`
);

// Load .env first
require('dotenv').config();
console.log('[migration] Sourced: .env');

// Load secrets file if it exists
if (fs.existsSync(secretsFile)) {
  require('dotenv').config({ path: secretsFile });
  console.log(`[migration] Sourced: .kamal/secrets.${env.toLowerCase()}`);
} else {
  console.log(`[migration] Warning: Secrets file not found: ${secretsFile}`);
}

const readline = require('readline');
const mysql = require('mysql2/promise');

const parseArgs = () => {
  const args = {
    isWetRun: false,
    isBackupMode: false,
    env: env,
  };

  process.argv.forEach((arg) => {
    if (arg === '--wet') {
      args.isWetRun = true;
    } else if (arg === '--backup') {
      args.isBackupMode = true;
    }
  });

  return args;
};

const { isWetRun, isBackupMode } = parseArgs();

const getDbConfig = (environment) => {
  const suffix = environment.toUpperCase();

  return {
    host: process.env[`PP_HOSTNAME_SSH_${suffix}`],
    user: process.env[`PP_USR_${suffix}`],
    password: process.env.PP_PWD,
    database: process.env.PP_DATABASE || 'EuroTourno',
  };
};

const dbConf = getDbConfig(env);

const ensureConfig = () => {
  const suffix = env.toUpperCase();
  const missing = [];

  if (!dbConf.host) missing.push(`PP_HOSTNAME_SSH_${suffix}`);
  if (!dbConf.user) missing.push(`PP_USR_${suffix}`);
  if (!dbConf.password) missing.push('PP_PWD');
  if (!dbConf.database) missing.push('PP_DATABASE');

  if (missing.length > 0) {
    console.log('\n[migration] Current environment variables:');
    console.log(`  PP_HOSTNAME_SSH_${suffix}: ${dbConf.host || '(missing)'}`);
    console.log(`  PP_USR_${suffix}: ${dbConf.user || '(missing)'}`);
    console.log(`  PP_PWD: ${dbConf.password ? '(set)' : '(missing)'}`);
    console.log(`  PP_DATABASE: ${dbConf.database || '(missing)'}`);
    throw new Error(
      `Missing DB env vars: ${missing.join(', ')}. Load your env first (for example: source .env and your secrets file).`
    );
  }
};

const promptForConfirmation = (message) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
};

const createTableSql = `
CREATE TABLE IF NOT EXISTS received_tournaments (
  id                   BIGINT NOT NULL AUTO_INCREMENT,
  archive_path         VARCHAR(1024) NOT NULL,
  checksum_sha256      CHAR(64) NOT NULL,
  file_size_bytes      BIGINT NOT NULL,
  submitted_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_by_user_id BIGINT NOT NULL,
  software_version     VARCHAR(64) DEFAULT NULL,
  tournament_id        INT DEFAULT NULL,
  event_uuid           CHAR(36) DEFAULT NULL,
  payload_json         JSON DEFAULT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_received_tournaments_submitted_by (submitted_by_user_id),
  KEY ix_received_tournaments_tournament_id (tournament_id),
  KEY ix_received_tournaments_event_uuid (event_uuid),
  CONSTRAINT fk_received_tournaments_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`;

const columnExists = async (connection, columnName) => {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'received_tournaments'
       AND column_name = ?`,
    [columnName]
  );
  return rows[0].count > 0;
};

const indexExists = async (connection, indexName) => {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'received_tournaments'
       AND index_name = ?`,
    [indexName]
  );
  return rows[0].count > 0;
};

const foreignKeyExists = async (connection, foreignKeyName) => {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = 'received_tournaments'
       AND constraint_type = 'FOREIGN KEY'
       AND constraint_name = ?`,
    [foreignKeyName]
  );
  return rows[0].count > 0;
};

const migrateToDesiredState = async (connection) => {
  await connection.query(createTableSql);

  if (!(await columnExists(connection, 'payload_json'))) {
    await connection.query(
      `ALTER TABLE received_tournaments ADD COLUMN payload_json JSON DEFAULT NULL`
    );
  }
  if (!(await columnExists(connection, 'tournament_id'))) {
    await connection.query(
      `ALTER TABLE received_tournaments ADD COLUMN tournament_id INT DEFAULT NULL`
    );
  }
  if (!(await columnExists(connection, 'event_uuid'))) {
    await connection.query(
      `ALTER TABLE received_tournaments ADD COLUMN event_uuid CHAR(36) DEFAULT NULL`
    );
  }
  if (
    !(await indexExists(connection, 'ix_received_tournaments_tournament_id'))
  ) {
    await connection.query(
      `ALTER TABLE received_tournaments ADD KEY ix_received_tournaments_tournament_id (tournament_id)`
    );
  }
  if (!(await indexExists(connection, 'ix_received_tournaments_event_uuid'))) {
    await connection.query(
      `ALTER TABLE received_tournaments ADD KEY ix_received_tournaments_event_uuid (event_uuid)`
    );
  }
  if (
    !(await foreignKeyExists(connection, 'fk_received_tournaments_tournament'))
  ) {
    await connection.query(
      `ALTER TABLE received_tournaments
       ADD CONSTRAINT fk_received_tournaments_tournament
       FOREIGN KEY (tournament_id) REFERENCES tournaments(id)`
    );
  }

  // Backfill payload_json for any legacy rows missing the full payload.
  await connection.query(`
    UPDATE received_tournaments
    SET payload_json = JSON_OBJECT(
      'tournament',
      JSON_OBJECT(
        'id', tournament_id,
        'eventUuid', event_uuid
      )
    )
    WHERE payload_json IS NULL
  `);
};

const runBackup = async () => {
  const backupFile = `backup_${dbConf.database}_${new Date().toISOString().split('T')[0]}.sql`;

  console.log('\n[migration] Database Backup');
  console.log('================================');
  console.log(`Target: ${backupFile}`);
  console.log(`Host:   ${dbConf.host}`);
  console.log(`DB:     ${dbConf.database}`);
  console.log('================================\n');

  const confirmed = await promptForConfirmation(
    'Are you sure you want to create a backup? (yes/no): '
  );

  if (!confirmed) {
    console.log('\n[migration] Backup cancelled.');
    process.exit(0);
  }

  console.log(`\n[migration] Creating backup: ${backupFile}...`);
  console.log(
    '[migration] This may take a few moments for large databases...\n'
  );

  const startTime = Date.now();
  const tmpFile = path.join(
    require('os').tmpdir(),
    `mysqldump-${Date.now()}.cnf`
  );

  try {
    // Create temporary options file with password (handles special chars safely)
    const optionsContent = `[client]\nhost=${dbConf.host}\nuser=${dbConf.user}\npassword=${dbConf.password}\n`;
    fs.writeFileSync(tmpFile, optionsContent, { mode: 0o600 });

    const writeStream = fs.createWriteStream(backupFile);
    const mysqldump = spawn(
      'mysqldump',
      [`--defaults-file=${tmpFile}`, dbConf.database],
      {
        stdio: ['ignore', 'pipe', 'inherit'],
      }
    );

    mysqldump.stdout.pipe(writeStream);

    await new Promise((resolve, reject) => {
      mysqldump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mysqldump exited with code ${code}`));
        }
      });
      mysqldump.on('error', reject);
      writeStream.on('error', reject);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[migration] Backup complete: ${backupFile} (${duration}s)`);
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(
      `\n[migration] Backup failed after ${duration}s: ${err.message}`
    );
    process.exit(1);
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
};

const runMigration = async () => {
  const confirmed = await promptForConfirmation(
    'Are you sure you want to run the migration? (yes/no): '
  );

  if (!confirmed) {
    console.log('\n[migration] Migration cancelled.');
    process.exit(0);
  }

  console.log('\n[migration] Executing migration...\n');

  const connection = await mysql.createConnection(dbConf);
  try {
    await migrateToDesiredState(connection);
    console.log(
      `[migration] received_tournaments table is now in desired state on "${dbConf.database}".`
    );
  } finally {
    await connection.end();
  }
};

const run = async () => {
  ensureConfig();

  console.log('\n[migration] Database Migration');
  console.log('================================');
  console.log(`Environment: ${env}`);
  console.log(`Host:        ${dbConf.host}`);
  console.log(`User:        ${dbConf.user}`);
  console.log(`Database:    ${dbConf.database}`);
  console.log('================================\n');

  // Mode selection
  if (isBackupMode && isWetRun) {
    console.error('[migration] Error: Cannot use --backup and --wet together.');
    console.error(
      '[migration] Run backup first, then run migration separately.'
    );
    process.exit(1);
  }

  if (isBackupMode) {
    await runBackup();
    process.exit(0);
  }

  if (isWetRun) {
    await runMigration();
    process.exit(0);
  }

  // Dry run mode
  console.log('[migration] DRY RUN MODE');
  console.log('[migration] No changes will be made.');
  console.log('');
  console.log('Usage:');
  console.log(
    `  node scripts/migrate-received-tournaments.js --env=${env} --backup  # Create backup`
  );
  console.log(
    `  node scripts/migrate-received-tournaments.js --env=${env} --wet     # Run migration`
  );
  console.log('');
};

run().catch((err) => {
  console.error(`[migration] failed: ${err.message}`);
  process.exit(1);
});
