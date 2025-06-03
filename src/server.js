const mysql = require("mysql");
const { processArgs } = require("./lib/process-args");
// const { dbConf } = require("../config"); // Moved down
const apiSetup = require("./api/index");
const ARGS = processArgs(process.argv);

const run = async () => {
  let db = null;
  if (!ARGS.useMock) {
    const { dbConf } = require("../config"); // Require config only if not in mock mode
    db = mysql.createConnection(dbConf);
    db.connect((err) => {
      if (err) {
        console.error("Error connecting to the database: ", err);
        return;
      }
      console.log("Connected to the MySQL server.");
    });
  }
  apiSetup(db, ARGS);
};

run();
