// @ts-nocheck
const mysql = require('mysql');
const { processArgs } = require('./lib/process-args');
const apiSetup = require('./api/index');
const ARGS = processArgs(process.argv);

// Import config from local directory
const { dbConf } = require('./config');

const run = async () => {
  let db = null;

  // Determine mock mode reliably based on ARGS.database,
  const isMockMode = ARGS.database === 'MockTourno';

  if (!isMockMode) {
    db = mysql.createConnection(dbConf);
    db.connect((err) => {
      if (err) {
        console.error(
          `Error connecting to the database.
          Please check the following:
          1. Is the database server running?
          2. Are you connected to the correct network or VPN?
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
