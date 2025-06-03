const mysql = require("mysql");
const { processArgs } = require("./lib/process-args");
// const { dbConf } = require("../config"); // Moved down
const apiSetup = require("./api/index");
const ARGS = processArgs(process.argv);

const run = async () => {
  let db = null;

  // Determine mock mode reliably based on ARGS.database,
  // as ARGS.useMock from processArgs might be unreliable.
  // In mock mode (from Makefile -> start-server.sh), ARGS.database is "MockTourno".
  const isMockMode = ARGS.database === "MockTourno";

  if (!isMockMode) { // If not in determined mock mode, attempt to connect to the database.
    const { dbConf } = require("../config"); 
    db = mysql.createConnection(dbConf);
    db.connect((err) => {
      if (err) {
        // This error is expected if DB is not running or accessible.
        console.error("Error connecting to the database: ", err);
        return;
      }
      console.log("Connected to the MySQL server.");
    });
  }

  // Ensure apiSetup and subsequent layers receive the correctly determined mock status.
  const effectiveArgs = { ...ARGS, useMock: isMockMode };
  apiSetup(db, effectiveArgs);
};

run();
