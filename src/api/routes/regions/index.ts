import express from 'express';
import regionController from '../../controllers/regions';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = regionController(dbMain, useMock);

  router.get('/', ctrl.listRegions);
  router.get('/:regionId', ctrl.listRegionInfo);
  router.get('/:regionId/clubs', ctrl.listRegionClubs);

  return router;
};
