import express from 'express';
import regionController from '../../controllers/regions';
import { validateNumericId } from '../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = regionController(db, useMock);

  router.get('/', ctrl.listRegions);
  router.get('/:regionId', validateNumericId('regionId'), ctrl.listRegionInfo);
  router.get(
    '/:regionId/clubs',
    validateNumericId('regionId'),
    ctrl.listRegionClubs
  );

  return router;
};
