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

async function main() {
  const connection = await mysql.createConnection(config);
  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM tournaments');
    const names = new Set(columns.map((c) => c.Field));
    const additions = {
      competitionSettings: 'JSON DEFAULT NULL',
      verifyGroupStages: 'BOOLEAN NOT NULL DEFAULT FALSE',
      groupStageVerificationHashes: 'JSON DEFAULT NULL',
    };
    for (const [name, definition] of Object.entries(additions)) {
      if (!names.has(name)) {
        console.log(`Add tournaments.${name}`);
        if (wetRun)
          await connection.query(
            `ALTER TABLE tournaments ADD COLUMN ${name} ${definition}`
          );
      }
    }
    const [tournaments] = await connection.query(
      'SELECT * FROM tournaments ORDER BY id'
    );
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = new Set(tables.map((t) => Object.values(t)[0]));
    const categories = new Map();
    for (const [table, field] of [
      ['fixtures', 'category'],
      ['tournament_competitions', 'name'],
      ['squads', 'category'],
      ['teams', 'competition'],
    ]) {
      if (!tableNames.has(table)) continue;
      const [rows] = await connection.query(
        `SELECT DISTINCT tournamentId, TRIM(${field}) AS category FROM ${table} WHERE NULLIF(TRIM(${field}), '') IS NOT NULL`
      );
      for (const row of rows) {
        const list = categories.get(row.tournamentId) || new Map();
        const key = row.category.toUpperCase();
        if (!list.has(key)) list.set(key, row.category);
        categories.set(row.tournamentId, list);
      }
    }
    const pending = tournaments.filter((t) => t.competitionSettings == null);
    console.log(
      `${wetRun ? 'Applying' : 'Dry run:'} ${pending.length} tournaments require backfill`
    );
    if (wetRun) {
      const backupDirectory = path.join(root, 'backups');
      fs.mkdirSync(backupDirectory, { recursive: true });
      const backupPath = path.join(
        backupDirectory,
        `competition-settings-${Date.now()}.json`
      );
      fs.writeFileSync(
        backupPath,
        JSON.stringify(
          pending.map((t) => ({
            id: t.id,
            pointsForWin: t.pointsForWin,
            pointsForDraw: t.pointsForDraw,
            pointsForLoss: t.pointsForLoss,
            verifyGroupStages: t.verifyGroupStages,
            competitionSettings: t.competitionSettings,
          })),
          null,
          2
        ),
        { mode: 0o600 }
      );
      console.log(`Saved scoring backup: ${backupPath}`);
      await connection.beginTransaction();
      try {
        for (const tournament of pending) {
          const settings = [...(categories.get(tournament.id)?.values() || [])]
            .sort()
            .map((category) => ({
              category,
              winPoints: Number(tournament.pointsForWin ?? 2),
              drawPoints: Number(tournament.pointsForDraw ?? 1),
              losePoints: Number(tournament.pointsForLoss ?? 0),
              verifyGroupStages: Boolean(tournament.verifyGroupStages),
            }));
          await connection.query(
            'UPDATE tournaments SET competitionSettings = ? WHERE id = ? AND competitionSettings IS NULL',
            [JSON.stringify(settings), tournament.id]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    console.log(
      'Legacy scoring columns retained as defaults for competitions added later.'
    );
  } finally {
    await connection.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
