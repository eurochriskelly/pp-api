import express from 'express';
import annualReportsController from '../../controllers/annual-reports';
import { validateNumericId } from '../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = annualReportsController(db);
  router.get('/', ctrl.getYearsSummary);
  router.get('/:year', validateNumericId('year'), ctrl.getAnnualReport);
  return router;
};
