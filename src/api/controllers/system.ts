import { Request, Response } from 'express';
import {
  setPrintSqlStatements,
  getPrintSqlStatements,
} from '../services/system';

const enablePrintSqlStatements = (req: Request, res: Response): void => {
  setPrintSqlStatements(true);
  res.status(200).send('SQL statement printing enabled.');
};

const disablePrintSqlStatements = (req: Request, res: Response): void => {
  setPrintSqlStatements(false);
  res.status(200).send('SQL statement printing disabled.');
};

const healthCheck = (req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    printSql: getPrintSqlStatements(),
  });
};

export = {
  enablePrintSqlStatements,
  disablePrintSqlStatements,
  healthCheck,
};
