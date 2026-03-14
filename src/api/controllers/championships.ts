import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/championships';
import mockServiceFactory from '../services/mocks/championships';

function championshipsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db) as any;

  const parseId = (value: string): number | null => {
    const id = parseInt(value, 10);
    return isNaN(id) ? null : id;
  };

  const parseEntrantRouteIds = (
    params: Record<string, string | undefined>
  ): { championshipId: number | null; entrantId: number | null } => {
    const hasCompatParam = params.entrantId !== undefined;
    const championshipRaw = hasCompatParam ? params.id : params.championshipId;
    const entrantRaw = hasCompatParam ? params.entrantId : params.id;
    return {
      championshipId: championshipRaw ? parseId(championshipRaw) : null,
      entrantId: entrantRaw ? parseId(entrantRaw) : null,
    };
  };

  return {
    listChampionships: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const rows = await dbSvc.listChampionships({
          seriesId: req.query.seriesId,
          year: req.query.year,
          status: req.query.status,
        });
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },

    getChampionshipById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseId(req.params.id);
        if (id === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const row = await dbSvc.getChampionshipById(id);
        if (!row) {
          res.status(404).json({ error: 'Championship not found' });
          return;
        }

        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    createChampionship: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { seriesId, name, year } = req.body;
        if (!seriesId || !name || !year) {
          res
            .status(400)
            .json({ error: 'seriesId, name and year are required' });
          return;
        }

        const row = await dbSvc.createChampionship(req.body);
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateChampionship: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseId(req.params.id);
        if (id === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const row = await dbSvc.updateChampionship(id, req.body);
        res.json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteChampionship: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseId(req.params.id);
        if (id === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const row = await dbSvc.deleteChampionship(id);
        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    listEntrants: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const championshipId = parseId(req.params.id);
        if (championshipId === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const rows = await dbSvc.listEntrants(championshipId);
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },

    createEntrant: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const championshipId = parseId(req.params.id);
        if (championshipId === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const { entrantType, displayName } = req.body;
        if (!entrantType || !displayName) {
          res
            .status(400)
            .json({ error: 'entrantType and displayName are required' });
          return;
        }

        const row = await dbSvc.createEntrant(championshipId, req.body);
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    getEntrantById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { championshipId, entrantId } = parseEntrantRouteIds(req.params);

        if (championshipId === null || entrantId === null) {
          res
            .status(400)
            .json({ error: 'Invalid championship ID or entrant ID' });
          return;
        }

        const row = await dbSvc.getEntrantById(championshipId, entrantId);
        if (!row) {
          res.status(404).json({ error: 'Entrant not found' });
          return;
        }

        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    updateEntrant: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { championshipId, entrantId } = parseEntrantRouteIds(req.params);

        if (championshipId === null || entrantId === null) {
          res
            .status(400)
            .json({ error: 'Invalid championship ID or entrant ID' });
          return;
        }

        const row = await dbSvc.updateEntrant(
          championshipId,
          entrantId,
          req.body
        );
        res.json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteEntrant: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { championshipId, entrantId } = parseEntrantRouteIds(req.params);

        if (championshipId === null || entrantId === null) {
          res
            .status(400)
            .json({ error: 'Invalid championship ID or entrant ID' });
          return;
        }

        const row = await dbSvc.deleteEntrant(championshipId, entrantId);
        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    addAmalgamationClub: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { championshipId, entrantId } = parseEntrantRouteIds(req.params);
        const clubId = parseId(String(req.body.clubId));

        if (championshipId === null || entrantId === null || clubId === null) {
          res.status(400).json({
            error: 'Invalid championship ID, entrant ID or clubId',
          });
          return;
        }

        const row = await dbSvc.addAmalgamationClub(
          championshipId,
          entrantId,
          clubId
        );
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    listRounds: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const championshipId = parseId(req.params.id);
        if (championshipId === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const rows = await dbSvc.listRounds(championshipId);
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },

    getStandings: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const championshipId = parseId(req.params.id);
        if (championshipId === null) {
          res.status(400).json({ error: 'Invalid championship ID' });
          return;
        }

        const standings = await dbSvc.getStandings(championshipId);
        res.json({ data: standings });
      } catch (err) {
        next(err);
      }
    },
  };
}

export = championshipsController;
