import express from 'express';
import clubsController from '../../controllers/clubs';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = clubsController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);

  // Public endpoints
  router.get('/', ctrl.listClubs);
  router.get('/:clubId', validateNumericId('clubId'), ctrl.getClubById);
  router.get('/:clubId/logo', validateNumericId('clubId'), ctrl.getLogo);

  // Protected endpoints
  router.post('/', auth, ctrl.createClub);
  router.put('/:clubId', auth, validateNumericId('clubId'), ctrl.updateClub);
  router.delete('/:clubId', auth, validateNumericId('clubId'), ctrl.deleteClub);
  router.post(
    '/:clubId/logo',
    auth,
    validateNumericId('clubId'),
    express.raw({ type: 'image/*', limit: '5mb' }),
    ctrl.uploadLogo
  );

  return router;
};
