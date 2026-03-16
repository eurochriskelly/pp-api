import express from 'express';
import eventsController from '../../controllers/events';
import authMiddleware from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const ctrl = eventsController(dbs, useMock);
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getEvents);
  router.get('/search', ctrl.searchEvents);
  router.get('/:eventId', validateNumericId('eventId'), ctrl.getEvent);

  router.post('/', protect, ctrl.createEvent);
  router.put(
    '/:eventId',
    protect,
    validateNumericId('eventId'),
    ctrl.updateEvent
  );
  router.delete(
    '/:eventId',
    protect,
    validateNumericId('eventId'),
    ctrl.deleteEvent
  );

  return router;
};
