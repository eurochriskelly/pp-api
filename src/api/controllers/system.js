const systemService = require('../services/system');

const enablePrintSqlStatements = (req, res) => {
  systemService.setPrintSqlStatements(true);
  res.status(200).send('SQL statement printing enabled.');
};

const disablePrintSqlStatements = (req, res) => {
  systemService.setPrintSqlStatements(false);
  res.status(200).send('SQL statement printing disabled.');
};

module.exports = {
  enablePrintSqlStatements,
  disablePrintSqlStatements,
};
