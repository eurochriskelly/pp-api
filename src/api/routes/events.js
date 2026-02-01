const express = require('express');
const eventsController = require('../controllers/events');
const authMiddleware = require('../middleware/auth');

module.exports = (dbs, useMock) => {
  const router = express.Router();
  // Pass the full dbs object to the controller so it can do cross-db validation
  const ctrl = eventsController(dbs, useMock);
  // Auth uses the main database
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getEvents);
  router.get('/search', ctrl.searchEvents);
  router.get('/:id', ctrl.getEvent);

  router.post('/', protect, ctrl.createEvent);
  router.put('/:id', protect, ctrl.updateEvent);
  router.delete('/:id', protect, ctrl.deleteEvent);

  return router;
};
