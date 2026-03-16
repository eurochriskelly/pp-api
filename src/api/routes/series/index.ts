import express from 'express';
import seriesController from '../../controllers/series';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = seriesController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listSeries);
  router.get('/:seriesId', validateNumericId('seriesId'), ctrl.getSeriesById);
  router.get(
    '/:seriesId/championships',
    validateNumericId('seriesId'),
    ctrl.listSeriesChampionships
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
