import express from 'express';
import clubsController from '../../controllers/clubs';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = clubsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  // Public endpoints
  router.get('/', ctrl.listClubs);
  router.get('/:clubId', validateNumericId('clubId'), ctrl.getClubById);
  router.get('/:clubId/logo', validateNumericId('clubId'), ctrl.getLogo);

  // Protected endpoints
  router.post('/', auth, ctrl.createClub);
  router.put('/:clubId', auth, validateNumericId('clubId'), ctrl.updateClub);
  router.delete('/:clubId', auth, validateNumericId('clubId'), ctrl.deleteClub);

  return router;
};
