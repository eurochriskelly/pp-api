import express from 'express';
import listingsController from '../../controllers/listings';
import authMiddleware from '../../middleware/auth';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const ctrl = listingsController(dbs, useMock);
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getListings);
  router.get('/:listingId', ctrl.getListing);
  router.get('/:listingId/events', ctrl.getListingEvents);
  router.get('/:listingId/timeline', ctrl.getListingTimeline);
  router.get('/:listingId/ical', ctrl.getListingIcal);

  router.post('/', protect, ctrl.createListing);
  router.put('/:listingId', protect, ctrl.updateListing);
  router.delete('/:listingId', protect, ctrl.deleteListing);

  return router;
};
