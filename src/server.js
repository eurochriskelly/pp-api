// @ts-nocheck
require('dotenv').config();

const mysql = require('mysql2');
const apiSetup = require('./api/index');

// Get version from package.json
const packageJson = require('../package.json');

// Dereference all from env at top
const port = parseInt(process.env.PP_PORT_API || process.env.PORT || '4001');
const app =
  process.env.PP_API_APP || `${process.env.PP_ENV || 'development'}/mobile`;
const database = process.env.PP_DATABASE || process.env.PP_DBN || 'EuroTourno';
const staticPath = `/gcp/dist/${app}/`;

const ARGS = { port, app, database, staticPath };

// Startup banner - impossible to miss
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
  let db = null;
  let dbClub = null;
  const effectiveArgs = { ...ARGS };
  try {
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

      db = mysql.createConnection(dbConf);
      await new Promise((resolve, reject) => {
        db.connect((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✓ Connected to MySQL (Main) - data will be persisted');

      dbClub = mysql.createConnection(clubEventsDbConf);
      await new Promise((resolve, reject) => {
        dbClub.connect((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✓ Connected to MySQL (ClubEvents)');
    }
    apiSetup({ main: db, club: dbClub }, effectiveArgs);
  } catch (err) {
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
    effectiveArgs.errorMsg = 'Bad news. Something went wrong. Check the logs.';
    effectiveArgs.useMock = true;
    apiSetup({ main: null, club: null }, effectiveArgs);
  }
};

run();
