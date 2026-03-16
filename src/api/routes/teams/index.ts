import express from 'express';
import teamsController from '../../controllers/teams';
import { validateNumericId } from '../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = teamsController(db, useMock);

  router.post('/batch', ctrl.createBatch);
  router.post('/assign-tournament', ctrl.assignTournament);
  router.get('/', ctrl.getTeams);
  router.get('/:teamId', validateNumericId('teamId'), ctrl.getTeam);
  router.get('/:teamId/logo', validateNumericId('teamId'), ctrl.getLogo);
  router.post('/', ctrl.createTeam);
  router.put('/:teamId', validateNumericId('teamId'), ctrl.updateTeam);

  return router;
};
