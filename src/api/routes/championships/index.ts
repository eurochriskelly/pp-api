import express from 'express';
import championshipsController from '../../controllers/championships';
import authMiddlewareFactory from '../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = championshipsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listChampionships);
  router.get('/:id', ctrl.getChampionshipById);
  router.get('/:id/entrants', ctrl.listEntrants);
  router.get('/:id/rounds', ctrl.listRounds);
  router.get('/:id/standings', ctrl.getStandings);
  router.get('/:championshipId/entrants/:id', ctrl.getEntrantById);
  router.get('/:id/entrants/:entrantId', ctrl.getEntrantById);

  router.post('/', auth, ctrl.createChampionship);
  router.put('/:id', auth, ctrl.updateChampionship);
  router.delete('/:id', auth, ctrl.deleteChampionship);
  router.post('/:id/entrants', auth, ctrl.createEntrant);
  router.put('/:championshipId/entrants/:id', auth, ctrl.updateEntrant);
  router.put('/:id/entrants/:entrantId', auth, ctrl.updateEntrant);
  router.delete('/:championshipId/entrants/:id', auth, ctrl.deleteEntrant);
  router.delete('/:id/entrants/:entrantId', auth, ctrl.deleteEntrant);
  router.post(
    '/:championshipId/entrants/:id/amalgamation-clubs',
    auth,
    ctrl.addAmalgamationClub
  );
  router.post(
    '/:id/entrants/:entrantId/amalgamation-clubs',
    auth,
    ctrl.addAmalgamationClub
  );

  return router;
};
