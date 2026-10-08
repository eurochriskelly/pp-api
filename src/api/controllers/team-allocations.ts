import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/team-allocations';
import mockFactory from '../services/mocks/team-allocations';
import { AllocationError } from '../services/team-allocations/model';

export default (db: any, useMock: boolean) => {
  const service = useMock ? mockFactory() : serviceFactory(db);
  const handle =
    (operation: (req: Request) => Promise<any>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({ data: await operation(req) });
      } catch (err) {
        if (err instanceof AllocationError) {
          res.status(err.status).json({ error: err.message });
        } else if (
          ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(
            (err as any)?.code
          )
        ) {
          res.status(503).json({
            error:
              'Team allocations are not set up yet. Apply the team allocation schema migration.',
          });
        } else {
          next(err);
        }
      }
    };
  return {
    list: handle((req) => service.list(Number(req.params.tournamentId))),
    save: handle(async (req) => {
      const tournamentId = Number(req.params.tournamentId);
      await service.save(tournamentId, Number(req.params.teamId), req.body);
      return service.list(tournamentId);
    }),
    assignRound: handle(async (req) => {
      const tournamentId = Number(req.params.tournamentId);
      await service.assignRound(
        tournamentId,
        Number(req.params.competitionId),
        req.body
      );
      return service.list(tournamentId);
    }),
    createChampionship: handle((req) => service.createChampionship(req.body)),
  };
};
