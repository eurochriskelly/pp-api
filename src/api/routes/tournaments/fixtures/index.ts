import express from 'express';
import fixtureController from '../../../controllers/fixtures';
import { validateNumericId } from '../../../middleware/validation';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = fixtureController(db, useMock);

  router.get('/', ctrl.getFixtures);
  router.get('/nextup', ctrl.nextFixtures);
  router.get('/pitches/:pitch/fixtures', ctrl.getFixtures);
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
