import { Request, Response } from 'express';
import {
  setPrintSqlStatements,
  getPrintSqlStatements,
} from '../services/system';

function systemController(db: any, useMock: boolean) {
  const database = process.env.PP_DATABASE || process.env.PP_DBN || 'unknown';

  return {
    enablePrintSqlStatements: (req: Request, res: Response): void => {
      setPrintSqlStatements(true);
      res.status(200).send('SQL statement printing enabled.');
    },

    disablePrintSqlStatements: (req: Request, res: Response): void => {
      setPrintSqlStatements(false);
      res.status(200).send('SQL statement printing disabled.');
    },

    getMode: (req: Request, res: Response): void => {
      res.json({
        mode: useMock ? 'mock' : 'database',
        useMock: useMock,
        database: database,
        timestamp: new Date().toISOString(),
        warning: useMock
          ? 'Running in MOCK MODE - all data stored in memory only!'
          : undefined,
      });
    },

    healthCheck: (req: Request, res: Response): void => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        printSql: getPrintSqlStatements(),
      });
    },
  };
}

export = systemController;
