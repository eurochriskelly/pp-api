import express from 'express';
import rulesetsController from '../../controllers/rulesets';
import authMiddlewareFactory from '../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = rulesetsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listRulesets);
  router.get('/:id', ctrl.getRulesetById);

  router.post('/', auth, ctrl.createRuleset);
  router.put('/:id', auth, ctrl.updateRuleset);

  return router;
};
