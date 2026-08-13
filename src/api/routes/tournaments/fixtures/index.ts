import express from 'express';
import fixtureController from '../../../controllers/fixtures';
import { validateNumericId } from '../../../middleware/validation';
import authMiddlewareFactory from '../../../middleware/auth';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = fixtureController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);

  router.get('/', ctrl.getFixtures);
  router.get('/nextup', ctrl.nextFixtures);
  router.get('/pitches/:pitch/fixtures', ctrl.getFixtures);
  router.put('/rewind', auth, ctrl.rewindFixture);
  // Retained for compatibility with older callers. Rewind always affects the
  // latest started fixture, so fixtureId is intentionally ignored.
  router.put(
    '/:fixtureId/rewind',
    auth,
    validateNumericId('fixtureId'),
    ctrl.rewindFixture
  );
  router.get(
    '/:fixtureId/carded-players',
    validateNumericId('fixtureId'),
    ctrl.getCardedPlayers
  );
  router.get('/:fixtureId', validateNumericId('fixtureId'), ctrl.getFixture);
  router.post('/filtered', ctrl.getFilteredFixtures);
  router.post('/copy', auth, ctrl.copyFixtures);

  // modify
  router.put('/update-calculated-fixtures', auth, ctrl.updateCalculatedFixtures);
  router.put(
    '/:fixtureId/update-calculated-fixtures',
    auth,
    validateNumericId('fixtureId'),
    ctrl.updateCalculatedFixtures
  );

  // create
  router.post(
    '/:fixtureId/start',
    auth,
    validateNumericId('fixtureId'),
    ctrl.startFixture
  );
  router.post(
    '/:fixtureId/end',
    auth,
    validateNumericId('fixtureId'),
    ctrl.endFixture
  );
  router.post(
    '/:fixtureId/reschedule',
    auth,
    validateNumericId('fixtureId'),
    ctrl.reschedule
  );
  router.post('/:fixtureId/slack', auth, validateNumericId('fixtureId'), ctrl.slack);
  router.post(
    '/:fixtureId/score',
    auth,
    validateNumericId('fixtureId'),
    ctrl.updateScore
  );
  router.post(
    '/:fixtureId/carded',
    auth,
    validateNumericId('fixtureId'),
    ctrl.cardPlayers
  );

  // Add the new DELETE route
  router.delete(
    '/:fixtureId/carded/:cardId',
    auth,
    validateNumericId('fixtureId'),
    validateNumericId('cardId'),
    ctrl.deleteCard
  );

  return router;
};
