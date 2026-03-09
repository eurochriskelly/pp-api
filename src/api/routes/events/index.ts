import express from 'express';
import eventsController from '../../controllers/events';
import authMiddleware from '../../middleware/auth';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const ctrl = eventsController(dbs, useMock);
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getEvents);
  router.get('/search', ctrl.searchEvents);
  router.get('/:id', ctrl.getEvent);

  router.post('/', protect, ctrl.createEvent);
  router.put('/:id', protect, ctrl.updateEvent);
  router.delete('/:id', protect, ctrl.deleteEvent);

  return router;
};
