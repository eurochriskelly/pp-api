import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/events';
import mockServiceFactory from '../services/mocks/events';

interface EventFilters {
  startDate?: string;
  endDate?: string;
  organizerId?: string;
  limit?: string;
}

interface SearchFilters {
  q?: string;
  includePast?: boolean;
}

function eventsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    getEvents: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { startDate, endDate, organizerId, limit } = req.query;
        // Support snake_case query params too just in case
        const filters: EventFilters = {
          startDate: (startDate || req.query.start_date) as string,
          endDate: (endDate || req.query.end_date) as string,
          organizerId: (organizerId || req.query.organizer_id) as string,
          limit: limit as string,
        };
        const events = await dbSvc.listEvents(filters);
        res.json({ data: events });
      } catch (err) {
        next(err);
      }
    },

    searchEvents: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { q, include_past } = req.query;
        const filters: SearchFilters = {
          q: q as string,
          includePast: include_past === 'true',
        };
        const events = await (dbSvc as any).searchEvents(filters);
        res.json({ data: events });
      } catch (err) {
        next(err);
      }
    },

    getEvent: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = req.params;
        const event = await dbSvc.getEvent(id);
        if (!event) {
          res.status(404).json({ error: 'Event not found' });
          return;
        }
        res.json({ data: event });
      } catch (err) {
        next(err);
      }
    },

    createEvent: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const event = await dbSvc.createEvent(req.body);
        res.status(201).json({ data: event });
      } catch (err) {
        if (
          (err as Error).message.includes('required') ||
          (err as Error).message.includes('not found')
        ) {
          res.status(400).json({ error: (err as Error).message });
          return;
        }
        next(err);
      }
    },

    updateEvent: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = req.params;
        await dbSvc.updateEvent(id, req.body);
        const updated = await dbSvc.getEvent(id);
        res.json({ data: updated });
      } catch (err) {
        next(err);
      }
    },

    deleteEvent: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = req.params;
        await dbSvc.deleteEvent(id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export = eventsController;
