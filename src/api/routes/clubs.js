const express = require('express');
const clubsController = require('../controllers/clubs');
const authMiddlewareFactory = require('../middleware/auth');

module.exports = (db, useMock) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = clubsController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  // Public endpoints
  router.get('/', ctrl.listClubs);
  router.get('/:id', ctrl.getClubById);
  router.get('/:id/logo', ctrl.getLogo);

  // Protected endpoints (require authentication)
  // Note: POST /:id/logo is handled in api/index.js with raw body parser
  router.post('/', auth, ctrl.createClub);
  router.put('/:id', auth, ctrl.updateClub);
  router.delete('/:id', auth, ctrl.deleteClub);

  return router;
};
