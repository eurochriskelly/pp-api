module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/events')
    : require('../services/events');
  // Pass the db object (which might be { main, club }) directly to factory
  const dbSvc = serviceFactory(db);

  return {
    getEvents: async (req, res, next) => {
      try {
        const { startDate, endDate, organizerId, limit } = req.query;
        // Support snake_case query params too just in case
        const filters = {
          startDate: startDate || req.query.start_date,
          endDate: endDate || req.query.end_date,
          organizerId: organizerId || req.query.organizer_id,
          limit,
        };
        const events = await dbSvc.listEvents(filters);
        res.json({ data: events });
      } catch (err) {
        next(err);
      }
    },
    searchEvents: async (req, res, next) => {
      try {
        const { q, include_past } = req.query;
        const filters = {
          q,
          includePast: include_past === 'true',
        };
        const events = await dbSvc.searchEvents(filters);
        res.json({ data: events });
      } catch (err) {
        next(err);
      }
    },
    getEvent: async (req, res, next) => {
      try {
        const { id } = req.params;
        const event = await dbSvc.getEvent(id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json({ data: event });
      } catch (err) {
        next(err);
      }
    },
    createEvent: async (req, res, next) => {
      try {
        const event = await dbSvc.createEvent(req.body);
        res.status(201).json({ data: event });
      } catch (err) {
        if (
          err.message.includes('required') ||
          err.message.includes('not found')
        ) {
          return res.status(400).json({ error: err.message });
        }
        next(err);
      }
    },
    updateEvent: async (req, res, next) => {
      try {
        const { id } = req.params;
        await dbSvc.updateEvent(id, req.body);
        const updated = await dbSvc.getEvent(id);
        res.json({ data: updated });
      } catch (err) {
        next(err);
      }
    },
    deleteEvent: async (req, res, next) => {
      try {
        const { id } = req.params;
        await dbSvc.deleteEvent(id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
};
