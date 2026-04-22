import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/listings';
import mockServiceFactory from '../services/mocks/listings';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

interface ListingFilters {
  search?: string;
  sport?: string | string[];
  region?: string;
  startDate?: string;
  endDate?: string;
  includePast?: boolean;
}

function listingsController(dbs: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(dbs);

  return {
    getListings: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const listings = await dbSvc.listListings();
        res.json({ data: listings });
      } catch (err) {
        next(err);
      }
    },

    getListing: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { listingId: id } = req.params;
        const { expand } = req.query;
        const expandEvents = expand === 'events';
        const listing = await dbSvc.getListing(id, expandEvents);
        if (!listing) {
          res.status(404).json({ error: 'Listing not found' });
          return;
        }
        res.json({ data: listing });
      } catch (err) {
        next(err);
      }
    },

    getListingEvents: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { listingId: id } = req.params;
        // Map query params to filters
        const filters: ListingFilters = {
          search: req.query.search as string,
          sport: req.query.sport as string | string[],
          region: req.query.region as string,
          startDate: (req.query.start_date || req.query.startDate) as string,
          endDate: (req.query.end_date || req.query.endDate) as string,
          includePast: req.query.include_past === 'true',
        };

        // Type assertion to handle both real and mock services
        const events = await (dbSvc as any).getListingEvents(id, filters);
        if (events === null) {
          res.status(404).json({ error: 'Listing not found' });
          return;
        }
        res.json({ data: events });
      } catch (err) {
        next(err);
      }
    },

    getListingTimeline: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { listingId: id } = req.params;
        // Type assertion to handle both real and mock services
        const timeline = await (dbSvc as any).getListingTimeline(id);
        if (timeline === null) {
          res.status(404).json({ error: 'Listing not found' });
          return;
        }
        res.json({ data: timeline });
      } catch (err) {
        next(err);
      }
    },

    getListingIcal: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { listingId: id } = req.params;
        const listing = await dbSvc.getListing(id, true);
        if (!listing) {
          res.status(404).json({ error: 'Listing not found' });
          return;
        }

        const iCalContent: string[] = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//PP-API//Listing Events//EN',
        ];

        const now =
          new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        if (listing.events && listing.events.length > 0) {
          listing.events.forEach(
            (event: {
              id: string;
              startDate?: string;
              endDate?: string;
              title: string;
              description?: string;
              location?: string;
            }) => {
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
              if (event.location)
                iCalContent.push(`LOCATION:${event.location}`);
              iCalContent.push('END:VEVENT');
            }
          );
        }

        iCalContent.push('END:VCALENDAR');

        res.set('Content-Type', 'text/calendar');
        res.set(
          'Content-Disposition',
          `attachment; filename="${(listing as any).slug || 'listing'}.ics"`
        );
        res.send(iCalContent.join('\r\n'));
      } catch (err) {
        next(err);
      }
    },

    createListing: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        // Extract fields and map to service expectations
        const { title, slug, description, event_ids, eventIds, hero_config } =
          req.body;
        const data = {
          title,
          slug,
          description,
          hero_config,
          eventIds: eventIds || event_ids || [],
          createdBy: req.user ? req.user.id : undefined,
        };

        const listing = await dbSvc.createListing(data);
        res.status(201).json({ data: listing });
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          res.status(409).json({
            error: 'Duplicate entry',
            message: 'A listing with this slug already exists.',
          });
          return;
        }
        next(err);
      }
    },

    updateListing: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { listingId: id } = req.params;
        const { title, slug, description, event_ids, eventIds, hero_config } =
          req.body;
        const data = {
          title,
          slug,
          description,
          hero_config,
          eventIds: eventIds || event_ids,
        };
        const listing = await dbSvc.updateListing(id, data);
        res.json({ data: listing });
      } catch (err) {
        next(err);
      }
    },

    deleteListing: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { listingId: id } = req.params;
        await dbSvc.deleteListing(id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export = listingsController;
