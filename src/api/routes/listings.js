const express = require('express');
const listingsController = require('../controllers/listings');
const authMiddleware = require('../middleware/auth');

module.exports = (dbs, useMock) => {
  const router = express.Router();
  const ctrl = listingsController(dbs, useMock);
  // Auth uses the main database
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getListings);
  router.get('/:id', ctrl.getListing); // :id can be slug too
  router.get('/:id/ical', ctrl.getListingIcal);

  router.post('/', protect, ctrl.createListing);
  router.put('/:id', protect, ctrl.updateListing);
  router.delete('/:id', protect, ctrl.deleteListing);

  return router;
};
