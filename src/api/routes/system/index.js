const express = require('express');
const systemController = require('../../controllers/system');

module.exports = (db, useMock) => {
  const router = express.Router();

  router.put(
    '/diagnostics/print-sql-statements',
    systemController.enablePrintSqlStatements
  );
  router.delete(
    '/diagnostics/print-sql-statements',
    systemController.disablePrintSqlStatements
  );

  router.get('/mode', (req, res) => {
    const database = process.env.PP_DATABASE || process.env.PP_DBN || 'unknown';
    res.json({
      mode: useMock ? 'mock' : 'database',
      useMock: useMock,
      database: database,
      timestamp: new Date().toISOString(),
      warning: useMock
        ? 'Running in MOCK MODE - all data stored in memory only!'
        : undefined,
    });
  });

  return router;
};
