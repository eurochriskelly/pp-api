let printSqlStatements = false;

export const setPrintSqlStatements = (value: boolean): void => {
  printSqlStatements = value;
};

export const getPrintSqlStatements = (): boolean => {
  return printSqlStatements;
};
