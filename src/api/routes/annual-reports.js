const express = require('express');
const annualReportsController = require('../controllers/annual-reports');

module.exports = (db, useMock) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = annualReportsController(db);
  router.get('/:year', ctrl.getAnnualReport);
  return router;
};
