import express from 'express';
import annualReportsController from '../../controllers/annual-reports';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = annualReportsController(db);
  router.get('/', ctrl.getYearsSummary);
  router.get('/:year', ctrl.getAnnualReport);
  return router;
};
