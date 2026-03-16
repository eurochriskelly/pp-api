import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/clubs';
import mockServiceFactory from '../services/mocks/clubs';

function clubsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    listClubs: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { search, limit = 10 } = req.query;
      try {
        const clubs = await dbSvc.listClubs(
          search as string,
          parseInt(limit as string)
        );
        res.json({ data: clubs });
      } catch (err) {
        next(err);
      }
    },

    getClubById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const clubId = parseInt(req.params.clubId, 10);
        if (isNaN(clubId)) {
          res.status(400).json({ error: 'Invalid club ID' });
          return;
        }

        const club = await dbSvc.getClubById(clubId);
        if (!club) {
          res.status(404).json({ error: 'Club not found' });
          return;
        }

        res.json({ data: club });
      } catch (err) {
        next(err);
      }
    },

    createClub: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { clubName } = req.body;
        if (!clubName) {
          res.status(400).json({ error: 'clubName is required' });
          return;
        }

        const club = await dbSvc.createClub(req.body);
        res.status(201).json({ data: club });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateClub: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const clubId = parseInt(req.params.clubId, 10);
        if (isNaN(clubId)) {
          res.status(400).json({ error: 'Invalid club ID' });
          return;
        }

        const club = await dbSvc.updateClub(clubId, req.body);
        res.json({ data: club });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteClub: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const clubId = parseInt(req.params.clubId, 10);
        if (isNaN(clubId)) {
          res.status(400).json({ error: 'Invalid club ID' });
          return;
        }

        const result = await dbSvc.deleteClub(clubId);
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    uploadLogo: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const clubId = parseInt(req.params.clubId, 10);
        if (isNaN(clubId)) {
          res.status(400).json({ error: 'Invalid club ID' });
          return;
        }

        if (!req.body || (req.body as Buffer).length === 0) {
          res.status(400).json({ error: 'Logo data is required' });
          return;
        }

        const result = await dbSvc.uploadLogo(clubId, req.body as Buffer);
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    getLogo: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const clubId = parseInt(req.params.clubId, 10);
        if (isNaN(clubId)) {
          res.status(400).json({ error: 'Invalid club ID' });
          return;
        }

        const logo = await dbSvc.getLogo(clubId);
        if (!logo) {
          res.status(404).json({ error: 'Logo not found' });
          return;
        }

        res.set('Content-Type', 'image/png');
        res.send(logo);
      } catch (err) {
        next(err);
      }
    },
  };
}

export = clubsController;
