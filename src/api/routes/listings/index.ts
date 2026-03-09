import express from 'express';
import listingsController from '../../controllers/listings';
import authMiddleware from '../../middleware/auth';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const ctrl = listingsController(dbs, useMock);
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getListings);
  router.get('/:id', ctrl.getListing);
  router.get('/:id/events', ctrl.getListingEvents);
  router.get('/:id/timeline', ctrl.getListingTimeline);
  router.get('/:id/ical', ctrl.getListingIcal);

  router.post('/', protect, ctrl.createListing);
  router.put('/:id', protect, ctrl.updateListing);
  router.delete('/:id', protect, ctrl.deleteListing);

  return router;
};
