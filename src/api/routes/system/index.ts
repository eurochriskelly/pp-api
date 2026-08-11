import express from 'express';
import systemController from '../../controllers/system';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const dbMain = dbs.main || dbs;
  const ctrl = systemController(dbMain, useMock);

  router.put(
    '/diagnostics/print-sql-statements',
    ctrl.enablePrintSqlStatements
  );
  router.delete(
    '/diagnostics/print-sql-statements',
    ctrl.disablePrintSqlStatements
  );

  router.get('/mode', ctrl.getMode);
  router.get('/health', ctrl.healthCheck);
  router.get('/capabilities', ctrl.getCapabilities);

  return router;
};
