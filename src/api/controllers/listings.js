module.exports = (dbs, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/listings')
    : require('../services/listings');
  const dbSvc = serviceFactory(dbs);

  return {
    getListings: async (req, res, next) => {
      try {
        const listings = await dbSvc.listListings();
        res.json({ data: listings });
      } catch (err) {
        next(err);
      }
    },
    getListing: async (req, res, next) => {
      try {
        const { id } = req.params;
        const { expand } = req.query;
        const expandEvents = expand === 'events';
        const listing = await dbSvc.getListing(id, expandEvents);
        if (!listing)
          return res.status(404).json({ error: 'Listing not found' });
        res.json({ data: listing });
      } catch (err) {
        next(err);
      }
    },
    createListing: async (req, res, next) => {
      try {
        const listing = await dbSvc.createListing(req.body);
        res.status(201).json({ data: listing });
      } catch (err) {
        next(err);
      }
    },
    updateListing: async (req, res, next) => {
      try {
        const { id } = req.params;
        const listing = await dbSvc.updateListing(id, req.body);
        res.json({ data: listing });
      } catch (err) {
        next(err);
      }
    },
    deleteListing: async (req, res, next) => {
      try {
        const { id } = req.params;
        await dbSvc.deleteListing(id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
};
