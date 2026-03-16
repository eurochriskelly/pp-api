import express from 'express';
import tournamentTeamsController from '../../../controllers/tournament-teams';
import authMiddlewareFactory from '../../../middleware/auth';
import { validateNumericId } from '../../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = tournamentTeamsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listTeams);
  router.get('/:id', validateNumericId('id'), ctrl.getTeamById);

  router.post('/', auth, ctrl.createTeam);
  router.put('/:id', auth, validateNumericId('id'), ctrl.updateTeam);
  router.delete('/:id', auth, validateNumericId('id'), ctrl.deleteTeam);

  router.post('/:id/squad', auth, validateNumericId('id'), ctrl.createSquad);
  router.put(
    '/:id/players/:playerId/assign',
    auth,
    validateNumericId('id'),
    validateNumericId('playerId'),
    ctrl.assignPlayer
  );

  return router;
};
