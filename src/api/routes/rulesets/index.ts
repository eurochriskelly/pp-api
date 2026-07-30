import express from 'express';
import rulesetsController from '../../controllers/rulesets';
import authMiddlewareFactory from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = rulesetsController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);

  router.get('/', ctrl.listRulesets);
  router.get(
    '/:rulesetId',
    validateNumericId('rulesetId'),
    ctrl.getRulesetById
  );

  router.post('/', auth, ctrl.createRuleset);
  router.put(
    '/:rulesetId',
    auth,
    validateNumericId('rulesetId'),
    ctrl.updateRuleset
  );

  return router;
};
