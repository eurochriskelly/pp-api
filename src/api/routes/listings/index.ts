import express from 'express';
import listingsController from '../../controllers/listings';
import authMiddleware from '../../middleware/auth';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const ctrl = listingsController(dbs, useMock);
  const protect = authMiddleware(dbs.main, useMock);

  router.get('/', ctrl.getListings);
  router.get('/:listingId', validateNumericId('listingId'), ctrl.getListing);
  router.get(
    '/:listingId/events',
    validateNumericId('listingId'),
    ctrl.getListingEvents
  );
  router.get(
    '/:listingId/timeline',
    validateNumericId('listingId'),
    ctrl.getListingTimeline
  );
  router.get(
    '/:listingId/ical',
    validateNumericId('listingId'),
    ctrl.getListingIcal
  );

  router.post('/', protect, ctrl.createListing);
  router.put(
    '/:listingId',
    protect,
    validateNumericId('listingId'),
    ctrl.updateListing
  );
  router.delete(
    '/:listingId',
    protect,
    validateNumericId('listingId'),
    ctrl.deleteListing
  );

  return router;
};
