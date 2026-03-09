import express from 'express';
import seriesController from '../../controllers/series';
import authMiddlewareFactory from '../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = seriesController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listSeries);
  router.get('/:id', ctrl.getSeriesById);
  router.get('/:id/championships', ctrl.listSeriesChampionships);

  router.post('/', auth, ctrl.createSeries);
  router.put('/:id', auth, ctrl.updateSeries);
  router.delete('/:id', auth, ctrl.deleteSeries);

  return router;
};
