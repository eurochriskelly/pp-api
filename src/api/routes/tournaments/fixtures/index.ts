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
  router.put('/rewind', ctrl.rewindFixture);
  // Retained for compatibility with older callers. Rewind always affects the
  // latest started fixture, so fixtureId is intentionally ignored.
  router.put(
    '/:fixtureId/rewind',
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
  router.put('/template-setup', auth, ctrl.updateTemplateSetup);
  router.patch('/:fixtureId/details', auth, validateNumericId('fixtureId'), ctrl.updateFixtureDetails);

  // modify
  router.put('/update-calculated-fixtures', ctrl.updateCalculatedFixtures);
  router.put(
    '/:fixtureId/update-calculated-fixtures',
    validateNumericId('fixtureId'),
    ctrl.updateCalculatedFixtures
  );

  // create
  router.post(
    '/:fixtureId/start',
    validateNumericId('fixtureId'),
    ctrl.startFixture
  );
  router.post(
    '/:fixtureId/end',
    validateNumericId('fixtureId'),
    ctrl.endFixture
  );
  router.post(
    '/:fixtureId/reschedule',
    validateNumericId('fixtureId'),
    ctrl.reschedule
  );
  router.post('/:fixtureId/slack', validateNumericId('fixtureId'), ctrl.slack);
  router.post(
    '/:fixtureId/score',
    validateNumericId('fixtureId'),
    ctrl.updateScore
  );
  router.post(
    '/:fixtureId/carded',
    validateNumericId('fixtureId'),
    ctrl.cardPlayers
  );

  // Add the new DELETE route
  router.delete(
    '/:fixtureId/carded/:cardId',
    validateNumericId('fixtureId'),
    validateNumericId('cardId'),
    ctrl.deleteCard
  );

  return router;
};
