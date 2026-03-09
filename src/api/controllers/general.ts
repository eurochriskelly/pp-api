import { Request, Response, NextFunction } from 'express';
import { jsonToCsv, sendXsls } from '../../lib/utils';
import serviceFactory from '../services/general';
import mockServiceFactory from '../services/mocks/general';

function generalController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    listTeams: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const phase = (req.query.stage as string).split('_').shift();
        const groupNumber = (req.query.group as string) || '0';
        const teams = await (dbSvc as any).listTeams(
          req.params.tournamentId,
          req.query.category as string,
          phase,
          parseInt(groupNumber)
        );
        res.json({ data: teams });
      } catch (err) {
        console.log(err);
        res.status(500).json({ code: 500, message: 'Internal Server Error' });
      }
    },

    listPitches: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const pitches = await dbSvc.listPitches(
          parseInt(req.params.tournamentId)
        );
        res.json({ data: pitches });
      } catch (err) {
        console.log(err);
        res.status(500).json({ code: 500, message: 'Internal Server Error' });
      }
    },

    listStandings: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { tournamentId } = req.params;
      const { format = 'json', category } = req.query;
      try {
        const { groups, data } = await (dbSvc as any).listStandings(
          tournamentId,
          category as string
        );
        switch (format) {
          case 'csv': {
            const csv = jsonToCsv(data as any);
            res.setHeader(
              'Content-Disposition',
              'attachment; filename="standings.csv"'
            );
            res.set('Content-Type', 'text/csv; charset=utf-8');
            res.send(csv);
            break;
          }
          case 'xlsx':
            sendXsls(data as any, res, 'standings');
            break;
          default:
            res.json({ groups, data });
            break;
        }
      } catch (err) {
        console.log(err);
        res.status(500).json({ code: 500, message: 'Internal Server Error' });
      }
    },

    getUsers: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { filter } = req.query;
      try {
        const users = await dbSvc.getUsers(filter as string);
        res.json({ data: users });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  };
}

export = generalController;
