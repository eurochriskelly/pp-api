const express = require('express');
const clubsController = require('../controllers/clubs');

module.exports = (db, useMock) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = clubsController(db, useMock);

  router.get('/', ctrl.listClubs);

  return router;
};
