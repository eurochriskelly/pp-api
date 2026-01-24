// @ts-nocheck
require('dotenv').config();

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
