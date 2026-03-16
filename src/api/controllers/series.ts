import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/series';
import mockServiceFactory from '../services/mocks/series';

function seriesController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    listSeries: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const rows = await dbSvc.listSeries(req.query.status as string);
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },

    getSeriesById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.seriesId, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid series ID' });
          return;
        }

        const row = await dbSvc.getSeriesById(id);
        if (!row) {
          res.status(404).json({ error: 'Series not found' });
          return;
        }

        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    createSeries: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { name } = req.body;
        if (!name) {
          res.status(400).json({ error: 'name is required' });
          return;
        }

        const row = await dbSvc.createSeries(req.body);
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateSeries: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.seriesId, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid series ID' });
          return;
        }

        const row = await dbSvc.updateSeries(id, req.body);
        res.json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteSeries: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.seriesId, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid series ID' });
          return;
        }

        const hard = req.query.hard === 'true';
        const row = await dbSvc.deleteSeries(id, hard);
        res.json({ data: row });
      } catch (err) {
        if ((err as Error).message.includes('not found')) {
          res.status(404).json({ error: 'Series not found' });
          return;
        }
        next(err);
      }
    },

    listSeriesChampionships: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.seriesId, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid series ID' });
          return;
        }

        const rows = await dbSvc.listSeriesChampionships(id);
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },
  };
}

export = seriesController;
