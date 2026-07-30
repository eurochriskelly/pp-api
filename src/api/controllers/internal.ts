import { Request, Response, NextFunction } from 'express';
import internalServiceFactory from '../services/internal';

interface CleanupBody {
  tables?: string[];
  keepUsers?: boolean;
}

interface SeedBody {
  scenario?: string;
  count?: number;
}

function internalController(db: any, useMock: boolean) {
  const service = internalServiceFactory(db, useMock);

  return {
    cleanup: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const body = (req.body || {}) as CleanupBody;
        const result = await service.cleanup(
          body.tables,
          body.keepUsers !== false
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },

    resetMocks: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await service.resetMocks();
        res.json(result);
      } catch (err: any) {
        if (err.code === 'MOCK_MODE_REQUIRED') {
          res.status(400).json({
            error: err.code,
            message: err.message,
          });
          return;
        }
        next(err);
      }
    },

    healthCheck: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await service.healthCheck();
        res.json(result);
      } catch (err: any) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: err.message,
        });
      }
    },

    schema: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await service.schema(req.query.table as any);
        res.json(result);
      } catch (err: any) {
        if (err.code === 'DB_CONNECTION_REQUIRED' || err.code === 'DB_NAME_NOT_RESOLVED') {
          res.status(400).json({ error: err.code, message: err.message });
          return;
        }
        next(err);
      }
    },

    tableCounts: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await service.tableCounts(req.query.table as any);
        res.json(result);
      } catch (err: any) {
        if (err.code === 'DB_CONNECTION_REQUIRED' || err.code === 'DB_NAME_NOT_RESOLVED') {
          res.status(400).json({ error: err.code, message: err.message });
          return;
        }
        next(err);
      }
    },

    seed: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const body = (req.body || {}) as SeedBody;
        const result = await service.seed(
          body.scenario || 'default',
          body.count || 10
        );
        res.json(result);
      } catch (err: any) {
        if (err.code === 'MOCK_MODE_REQUIRED') {
          res.status(400).json({
            error: err.code,
            message: err.message,
          });
          return;
        }
        next(err);
      }
    },
  };
}

export = internalController;
