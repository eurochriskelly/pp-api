import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/annual-reports';

function annualReportsController(db: any) {
  const service = serviceFactory(db);

  return {
    getYearsSummary: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const years = await service.getYearsSummary();
        res.json({ data: years });
      } catch (err) {
        next(err);
      }
    },

    getAnnualReport: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { year } = req.params;
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum)) {
          res.status(400).json({ error: 'Invalid year parameter' });
          return;
        }
        const report = await service.getAnnualReport(yearNum);
        res.json({ data: report });
      } catch (err) {
        if ((err as Error).message === 'No data found for year') {
          res.status(404).json({ error: (err as Error).message });
          return;
        }
        next(err);
      }
    },
  };
}

export = annualReportsController;
