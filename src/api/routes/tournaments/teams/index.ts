import express from 'express';
import tournamentTeamsController from '../../../controllers/tournament-teams';
import authMiddlewareFactory from '../../../middleware/auth';
import requireRole from '../../../middleware/authorization';
import { validateNumericId } from '../../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = tournamentTeamsController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);

  router.get('/', ctrl.listTeams);
  router.get('/:id', validateNumericId('id'), ctrl.getTeamById);

  router.post('/', auth, requireRole(['organizer', 'admin']), ctrl.createTeam);
  router.put(
    '/:id',
    auth,
    requireRole(['organizer', 'admin']),
    validateNumericId('id'),
    ctrl.updateTeam
  );
  router.delete(
    '/:id',
    auth,
    requireRole(['organizer', 'admin']),
    validateNumericId('id'),
    ctrl.deleteTeam
  );

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
