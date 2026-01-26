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
    getListingIcal: async (req, res, next) => {
      try {
        const { id } = req.params;
        const listing = await dbSvc.getListing(id, true);
        if (!listing) {
          return res.status(404).json({ error: 'Listing not found' });
        }

        let iCalContent = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//PP-API//Listing Events//EN',
        ];

        const now =
          new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        if (listing.events && listing.events.length > 0) {
          listing.events.forEach((event) => {
            const startDate = event.startDate
              ? new Date(event.startDate)
                  .toISOString()
                  .replace(/[-:]/g, '')
                  .split('.')[0] + 'Z'
              : '';
            const endDate = event.endDate
              ? new Date(event.endDate)
                  .toISOString()
                  .replace(/[-:]/g, '')
                  .split('.')[0] + 'Z'
              : '';

            iCalContent.push('BEGIN:VEVENT');
            iCalContent.push(`UID:${event.id}@pp-api`);
            iCalContent.push(`DTSTAMP:${now}`);
            if (startDate) iCalContent.push(`DTSTART:${startDate}`);
            if (endDate) iCalContent.push(`DTEND:${endDate}`);
            iCalContent.push(`SUMMARY:${event.title}`);
            if (event.description)
              iCalContent.push(`DESCRIPTION:${event.description}`);
            if (event.location) iCalContent.push(`LOCATION:${event.location}`);
            iCalContent.push('END:VEVENT');
          });
        }

        iCalContent.push('END:VCALENDAR');

        res.set('Content-Type', 'text/calendar');
        res.set(
          'Content-Disposition',
          `attachment; filename="${listing.slug || 'listing'}.ics"`
        );
        res.send(iCalContent.join('\r\n'));
      } catch (err) {
        next(err);
      }
    },
    createListing: async (req, res, next) => {
      try {
        // Extract fields and map to service expectations
        const { title, slug, description, event_ids, eventIds } = req.body;
        const data = {
          title,
          slug,
          description,
          eventIds: eventIds || event_ids || [],
          createdBy: req.user ? req.user.id : undefined,
        };

        const listing = await dbSvc.createListing(data);
        res.status(201).json({ data: listing });
      } catch (err) {
        next(err);
      }
    },
    updateListing: async (req, res, next) => {
      try {
        const { id } = req.params;
        const { title, slug, description, event_ids, eventIds } = req.body;
        const data = {
          title,
          slug,
          description,
          eventIds: eventIds || event_ids,
        };
        const listing = await dbSvc.updateListing(id, data);
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
