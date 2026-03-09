import express from 'express';
import clubsController from '../../controllers/clubs';
import authMiddlewareFactory from '../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = clubsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  // Public endpoints
  router.get('/', ctrl.listClubs);
  router.get('/:id', ctrl.getClubById);
  router.get('/:id/logo', ctrl.getLogo);

  // Protected endpoints
  router.post('/', auth, ctrl.createClub);
  router.put('/:id', auth, ctrl.updateClub);
  router.delete('/:id', auth, ctrl.deleteClub);

  return router;
};
