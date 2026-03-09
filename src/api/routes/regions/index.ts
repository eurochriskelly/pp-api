import express from 'express';
import regionController from '../../controllers/regions';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = regionController(db, useMock);

  router.get('/', ctrl.listRegions);
  router.get('/:region', ctrl.listRegionInfo);
  router.get('/:region/clubs', ctrl.listRegionClubs);

  return router;
};
