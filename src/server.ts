import dotenv from 'dotenv';
import mysql from 'mysql2';
import apiSetup from './api/index';
import path from 'path';

dotenv.config();

// Get version from package.json
// Works both with tsx (src/) and compiled output (dist/src/)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require(path.resolve(process.cwd(), 'package.json'));

// Dereference all from env at top
const port = parseInt(process.env.PP_PORT_API || process.env.PORT || '4001');
const app =
  process.env.PP_API_APP || `${process.env.PP_ENV || 'development'}/mobile`;
const database = process.env.PP_DATABASE || process.env.PP_DBN || 'EuroTourno';
const staticPath = `/gcp/dist/${app}/`;

const ARGS = { port, app, database, staticPath };

const ensureUtf8mb4Pool = (pool: mysql.Pool) => {
  pool.on('connection', (connection) => {
    connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
  });
};

// Startup banner - impossible to miss
console.log('╔══════════════════════════════════════════════════════════╗');
console.log(
  `║  PP-API v${packageJson.version}                                    ║`
);
console.log(
  `║  Environment: ${process.env.PP_ENV || 'development'}`.padEnd(58) + '║'
);
console.log(`║  Database: ${database}`.padEnd(58) + '║');
console.log(`║  Port: ${port}`.padEnd(58) + '║');
if (database === 'MockTourno') {
  console.log('║  ⚠️  MODE: MOCK ONLY (data in memory, not persisted)    ║');
}
console.log('╚══════════════════════════════════════════════════════════╝');

// Import config from local directory
const run = async () => {
  let db: mysql.Pool | null = null;
  let dbClub: mysql.Pool | null = null;
  const effectiveArgs: { [key: string]: any } = { ...ARGS };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dbConf, clubEventsDbConf } = require('./config');
    const isMockMode = database === 'MockTourno';
    effectiveArgs.useMock = isMockMode;
    if (isMockMode) {
      console.log(
        '⚠️  MOCK MODE: Using in-memory data (no database persistence)'
      );
    } else {
      console.log('--- DATABASE CONNECTION INFO ---');
      console.log(`Host:     ${dbConf.host || 'localhost (default)'}`);
      console.log(`User:     ${dbConf.user}`);
      console.log(`Database: ${dbConf.database}`);
      console.log('--------------------------------');

      db = mysql.createPool(dbConf);
      ensureUtf8mb4Pool(db);
      await new Promise<void>((resolve, reject) => {
        db!.query('SELECT 1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✓ Connected to MySQL (Main) - data will be persisted');

      // Try to connect to ClubEvents DB, but allow it to fail gracefully
      try {
        dbClub = mysql.createPool(clubEventsDbConf);
        ensureUtf8mb4Pool(dbClub);
        await new Promise<void>((resolve, reject) => {
          dbClub!.query('SELECT 1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log('✓ Connected to MySQL (ClubEvents)');
      } catch (clubErr: any) {
        dbClub = null;
        if (clubErr.message && clubErr.message.includes('Unknown database')) {
          console.log(
            `⚠️  ${clubEventsDbConf.database} database not found - skipping ClubEvents features`
          );
        } else {
          console.log(
            `⚠️  Could not connect to ClubEvents: ${clubErr.message}`
          );
        }
      }
    }
    apiSetup({ main: db, club: dbClub }, effectiveArgs as any);
  } catch (err: any) {
    console.error(`Startup error: ${err.message}`);
    console.error(
      '╔══════════════════════════════════════════════════════════╗'
    );
    console.error(
      '║  ⚠️  FALLBACK TO MOCK MODE ACTIVATED                      ║'
    );
    console.error(
      '║  Database connection failed - running in memory only     ║'
    );
    console.error(
      '║  All data will be lost on restart!                       ║'
    );
    console.error(
      '╚══════════════════════════════════════════════════════════╝'
    );
    effectiveArgs.useMock = true;
    apiSetup({ main: null, club: null }, effectiveArgs as any);
  }
};

run();
