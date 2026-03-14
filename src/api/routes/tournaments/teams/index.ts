import express from 'express';
import tournamentTeamsController from '../../../controllers/tournament-teams';
import authMiddlewareFactory from '../../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = tournamentTeamsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listTeams);
  router.get('/:id', ctrl.getTeamById);

  router.post('/', auth, ctrl.createTeam);
  router.put('/:id', auth, ctrl.updateTeam);
  router.delete('/:id', auth, ctrl.deleteTeam);

  router.post('/:id/squad', auth, ctrl.createSquad);
  router.put('/:id/players/:playerId/assign', auth, ctrl.assignPlayer);

  return router;
};
