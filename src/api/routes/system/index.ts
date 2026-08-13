import express from 'express';
import systemController from '../../controllers/system';
import authMiddleware from '../../middleware/auth';
import requireRole from '../../middleware/authorization';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const dbMain = dbs.main || dbs;
  const ctrl = systemController(dbMain, useMock);
  const protect = authMiddleware(dbMain, useMock);
  const requireAdmin = requireRole(['admin']);

  router.put(
    '/diagnostics/print-sql-statements',
    protect,
    requireAdmin,
    ctrl.enablePrintSqlStatements
  );
  router.delete(
    '/diagnostics/print-sql-statements',
    protect,
    requireAdmin,
    ctrl.disablePrintSqlStatements
  );

  router.get('/mode', ctrl.getMode);
  router.get('/health', ctrl.healthCheck);
  router.get('/capabilities', ctrl.getCapabilities);

  return router;
};
