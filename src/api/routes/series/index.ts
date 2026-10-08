import express from 'express';
import seriesController from '../../controllers/series';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = seriesController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);

  router.get('/', ctrl.listSeries);
  router.get('/:seriesId', validateNumericId('seriesId'), ctrl.getSeriesById);
  router.get(
    '/:seriesId/championships',
    validateNumericId('seriesId'),
    ctrl.listSeriesChampionships
  );
  router.get(
    '/:seriesId/eligible-clubs',
    validateNumericId('seriesId'),
    ctrl.listEligibleClubs
  );

  router.post('/', auth, ctrl.createSeries);
  router.put(
    '/:seriesId',
    auth,
    validateNumericId('seriesId'),
    ctrl.updateSeries
  );
  router.delete(
    '/:seriesId',
    auth,
    validateNumericId('seriesId'),
    ctrl.deleteSeries
  );

  return router;
};
