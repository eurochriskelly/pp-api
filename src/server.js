// @ts-nocheck
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
  const effectiveArgs = { ...ARGS };
  try {
    const { dbConf } = require('./config');
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
      console.log('Connected to the MySQL server.');
    }
    apiSetup(db, effectiveArgs);
  } catch (err) {
    console.error(`Startup error: ${err.message}`);
    effectiveArgs.errorMsg = 'Bad news. Something went wrong. Check the logs.';
    effectiveArgs.useMock = true;
    apiSetup(null, effectiveArgs);
  }
};

run();
