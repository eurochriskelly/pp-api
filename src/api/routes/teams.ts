import express from 'express';
import teamsController from '../controllers/teams';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = teamsController(db, useMock);

  router.post('/batch', ctrl.createBatch);
  router.post('/assign-tournament', ctrl.assignTournament);
  router.get('/', ctrl.getTeams);
  router.get('/:id', ctrl.getTeam);
  router.get('/:id/logo', ctrl.getLogo);
  router.post('/', ctrl.createTeam);
  router.put('/:id', ctrl.updateTeam);

  return router;
};
