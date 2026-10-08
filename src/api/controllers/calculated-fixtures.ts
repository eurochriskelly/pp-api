import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/fixtures/calculated-fixtures';
import mockServiceFactory from '../services/mocks/calculated-fixtures';

export default (db: any, useMock: boolean) => {
  const service = (useMock ? mockServiceFactory : serviceFactory)(db);
  return {
    refresh: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { category, mode = 'resolve' } = req.body || {};
        if (
          !['resolve', 'pending', 'contested'].includes(mode) ||
          (category !== undefined &&
            (typeof category !== 'string' || !category.trim()))
        ) {
          res.status(400).json({ error: 'INVALID_REFRESH_OPTIONS' });
          return;
        }
        const result = await service.refresh(Number(req.params.tournamentId), {
          category: category?.trim(),
          mode,
          approveGroups: mode === 'resolve',
        });
        res.json({ data: result });
      } catch (error) {
        if ((error as any).statusCode === 404) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  };
};
