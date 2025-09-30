const express = require('express');
const router = express.Router();
const systemController = require('../controllers/system');

router.put(
  '/diagnostics/print-sql-statements',
  systemController.enablePrintSqlStatements
);
router.delete(
  '/diagnostics/print-sql-statements',
  systemController.disablePrintSqlStatements
);

module.exports = router;
