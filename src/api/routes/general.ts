import express from 'express';
import generalController from '../controllers/general';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = generalController(db, useMock);

  router.get('/tournaments/:tournamentId/pitches', ctrl.listPitches);
  router.get('/tournaments/:tournamentId/teams', ctrl.listTeams);
  router.get('/tournaments/:tournamentId/standings', ctrl.listStandings);
  router.get('/users', ctrl.getUsers);

  return router;
};
