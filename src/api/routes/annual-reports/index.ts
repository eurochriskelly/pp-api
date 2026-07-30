import express from 'express';
import annualReportsController from '../../controllers/annual-reports';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = annualReportsController(dbMain, useMock);
  router.get('/', ctrl.getYearsSummary);
  router.get('/:year', validateNumericId('year'), ctrl.getAnnualReport);
  return router;
};
