let printSqlStatements = false;

const setPrintSqlStatements = (value) => {
  printSqlStatements = value;
};

const getPrintSqlStatements = () => {
  return printSqlStatements;
};

module.exports = {
  setPrintSqlStatements,
  getPrintSqlStatements,
};
