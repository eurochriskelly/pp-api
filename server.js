const mysql = require("mysql");
const { processArgs } = require("./lib/process-args");
const { dbConf } = require("../../config/config");
const apiSetup = require("./api/index");
const ARGS = processArgs(process.argv);

const run = async () => {
  let db = null;
  if (!ARGS.mock) {
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
