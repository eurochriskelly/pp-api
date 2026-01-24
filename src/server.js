// @ts-nocheck
require('dotenv').config();

// --- DEBUG & CONFIG PRE-CHECK ---
console.log('--- STARTUP DEBUG INFO ---');
console.log(`Node Version: ${process.version}`);
console.log(`PP_ENV: ${process.env.PP_ENV}`);
console.log(`PP_DATABASE (initial): ${process.env.PP_DATABASE}`);

const requiredForNonMock = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'PP_HST',
  'PP_USR',
  'PP_PWD',
];
const missingVars = requiredForNonMock.filter((k) => !process.env[k]);

if (missingVars.length > 0 && process.env.PP_DATABASE !== 'MockTourno') {
  console.warn(
    `\n[WARNING] Missing environment variables for non-mock mode: ${missingVars.join(', ')}`
  );
  console.warn(
    '[INFO] Automatically switching to MockTourno mode to allow server startup.'
  );
  process.env.PP_DATABASE = 'MockTourno';
}
console.log(
  `PP_DATABASE (effective): ${process.env.PP_DATABASE || 'MockTourno (defaulted)'}`
);
console.log('----------------------------\n');
// --------------------------------

const mysql = require('mysql2');
const apiSetup = require('./api/index');

// Dereference all from env at top
const port = parseInt(process.env.PP_PORT_API || process.env.PORT || '4001');
const app =
  process.env.PP_API_APP || `${process.env.PP_ENV || 'development'}/mobile`;
const database = process.env.PP_DATABASE || process.env.PP_DBN || 'EuroTourno';
const staticPath = `/gcp/dist/${app}/`;

const ARGS = { port, app, database, staticPath };

console.log(
  `Using PP_ENV=${process.env.PP_ENV || 'development'}, database=${database}, app=${app}, port=${port}`
);

// Import config from local directory
const run = async () => {
  let db = null;
  let dbClub = null;
  const effectiveArgs = { ...ARGS };
  try {
    const { dbConf, clubEventsDbConf } = require('./config');
    const isMockMode = database === 'MockTourno';
    effectiveArgs.useMock = isMockMode;
    if (!isMockMode) {
      db = mysql.createConnection(dbConf);
      await new Promise((resolve, reject) => {
        db.connect((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Connected to the MySQL server (Main).');

      dbClub = mysql.createConnection(clubEventsDbConf);
      await new Promise((resolve, reject) => {
        dbClub.connect((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('Connected to the MySQL server (ClubEvents).');
    }
    apiSetup({ main: db, club: dbClub }, effectiveArgs);
  } catch (err) {
    console.error(`Startup error: ${err.message}`);
    effectiveArgs.errorMsg = 'Bad news. Something went wrong. Check the logs.';
    effectiveArgs.useMock = true;
    apiSetup({ main: null, club: null }, effectiveArgs);
  }
};

run();
