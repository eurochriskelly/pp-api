import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/regions';
import mockServiceFactory from '../services/mocks/regions';

function regionsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    listRegions: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const regions = await dbSvc.listRegions();
        res.json({ data: regions });
      } catch (err) {
        next(err);
      }
    },

    listRegionInfo: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const info = await dbSvc.listRegionInfo(req.params.region, req.query);
        res.json(info);
      } catch (err) {
        next(err);
      }
    },

    listRegionClubs: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        // Type assertion to handle both real and mock services
        const clubs = await (dbSvc as any).listRegionClubs(req.params.region);
        res.json({ data: clubs });
      } catch (err) {
        next(err);
      }
    },
  };
}

export = regionsController;
