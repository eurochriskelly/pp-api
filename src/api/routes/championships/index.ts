import express from 'express';
import championshipsController from '../../controllers/championships';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = championshipsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listChampionships);
  router.get(
    '/:championshipId',
    validateNumericId('championshipId'),
    ctrl.getChampionshipById
  );
  router.get(
    '/:championshipId/entrants',
    validateNumericId('championshipId'),
    ctrl.listEntrants
  );
  router.get(
    '/:championshipId/rounds',
    validateNumericId('championshipId'),
    ctrl.listRounds
  );
  router.get(
    '/:championshipId/standings',
    validateNumericId('championshipId'),
    ctrl.getStandings
  );
  router.get(
    '/:championshipId/entrants/:entrantId',
    validateNumericId('championshipId'),
    validateNumericId('entrantId'),
    ctrl.getEntrantById
  );

  router.post('/', auth, ctrl.createChampionship);
  router.put(
    '/:championshipId',
    auth,
    validateNumericId('championshipId'),
    ctrl.updateChampionship
  );
  router.delete(
    '/:championshipId',
    auth,
    validateNumericId('championshipId'),
    ctrl.deleteChampionship
  );
  router.post(
    '/:championshipId/entrants',
    auth,
    validateNumericId('championshipId'),
    ctrl.createEntrant
  );
  router.put(
    '/:championshipId/entrants/:entrantId',
    auth,
    validateNumericId('championshipId'),
    validateNumericId('entrantId'),
    ctrl.updateEntrant
  );
  router.delete(
    '/:championshipId/entrants/:entrantId',
    auth,
    validateNumericId('championshipId'),
    validateNumericId('entrantId'),
    ctrl.deleteEntrant
  );
  router.post(
    '/:championshipId/entrants/:entrantId/amalgamation-clubs',
    auth,
    validateNumericId('championshipId'),
    validateNumericId('entrantId'),
    ctrl.addAmalgamationClub
  );

  return router;
};
