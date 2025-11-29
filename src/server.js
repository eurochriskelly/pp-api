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
const { dbConf } = require('./config');

const run = async () => {
  let db = null;

  const isMockMode = database === 'MockTourno';

  if (!isMockMode) {
    db = mysql.createConnection(dbConf);
    db.connect((err) => {
      if (err) {
        console.error(
          `Error connecting to the database.
Please check the following:
1. Is the database server running?
2. Are you connected to the network or VPN?
3. Are the credentials in your environment correct?
           
Original error:`,
          err
        );
        return;
      }
      console.log('Connected to the MySQL server.');
    });
  }

  const effectiveArgs = { ...ARGS, useMock: isMockMode };
  apiSetup(db, effectiveArgs);
};

run();
