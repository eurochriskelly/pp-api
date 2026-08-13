import express from 'express';
import teamsController from '../../controllers/teams';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = teamsController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);

  router.post('/batch', auth, ctrl.createBatch);
  router.post('/assign-tournament', auth, ctrl.assignTournament);
  router.get('/', ctrl.getTeams);
  router.get('/:teamId', validateNumericId('teamId'), ctrl.getTeam);
  router.get('/:teamId/logo', validateNumericId('teamId'), ctrl.getLogo);
  router.post(
    '/:teamId/logo',
    auth,
    validateNumericId('teamId'),
    express.raw({ type: 'image/png', limit: '5mb' }),
    ctrl.uploadLogo
  );
  router.post('/', auth, ctrl.createTeam);
  router.put('/:teamId', auth, validateNumericId('teamId'), ctrl.updateTeam);

  return router;
};
