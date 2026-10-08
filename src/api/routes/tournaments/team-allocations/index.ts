import express from 'express';
import controller from '../../../controllers/team-allocations';
import editor from '../../../middleware/team-allocation-editor';
import { validateNumericId } from '../../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const db = dbs.main || dbs;
  const router = express.Router({ mergeParams: true });
  const ctrl = controller(db, useMock);
  const authorize = editor(db, useMock);
  router.get('/', ctrl.list);
  router.post('/access', authorize, (_req, res) => {
    res.json({ data: { authorized: true } });
  });
  router.post('/championships', authorize, ctrl.createChampionship);
  router.put(
    '/teams/:teamId',
    authorize,
    validateNumericId('teamId'),
    ctrl.save
  );
  router.put(
    '/competitions/:competitionId/round',
    authorize,
    validateNumericId('competitionId'),
    ctrl.assignRound
  );
  return router;
};
