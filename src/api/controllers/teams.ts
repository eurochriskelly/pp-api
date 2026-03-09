import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/teams';
import mockServiceFactory from '../services/mocks/teams';

type TeamParams = {
  id: string;
};

function teamsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc: any = factory(db);

  return {
    getTeams: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentTempUuid, tournamentId, competition } = req.query as {
          tournamentTempUuid?: string;
          tournamentId?: string;
          competition?: string;
        };

        const parsedTournamentId = tournamentId
          ? parseInt(tournamentId, 10)
          : undefined;
        if (tournamentId && isNaN(parsedTournamentId as number)) {
          res.status(400).json({ error: 'INVALID_TOURNAMENT_ID' });
          return;
        }

        const data = await dbSvc.getTeams({
          tournamentTempUuid,
          tournamentId: parsedTournamentId,
          competition,
        });

        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    getTeam: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TeamParams;
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }

        const data = await dbSvc.getTeamById(numericId);
        if (!data) {
          res.status(404).json({ error: 'NOT_FOUND' });
          return;
        }

        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    createTeam: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, tournamentTempUuid } = req.body || {};
        if (!name || !tournamentTempUuid) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'name and tournamentTempUuid are required',
          });
          return;
        }

        const data = await dbSvc.createTeam(req.body);
        res.status(201).json({ data });
      } catch (err) {
        next(err);
      }
    },

    createBatch: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentTempUuid, teams } = req.body || {};
        if (
          !tournamentTempUuid ||
          !Array.isArray(teams) ||
          teams.length === 0
        ) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'tournamentTempUuid and non-empty teams[] are required',
          });
          return;
        }

        const data = await dbSvc.createBatch(tournamentTempUuid, teams);
        res.status(201).json({ data });
      } catch (err) {
        next(err);
      }
    },

    assignTournament: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentTempUuid, tournamentId } = req.body || {};
        const numericTournamentId = parseInt(tournamentId, 10);

        if (!tournamentTempUuid || isNaN(numericTournamentId)) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'tournamentTempUuid and numeric tournamentId are required',
          });
          return;
        }

        const data = await dbSvc.assignTournament(
          tournamentTempUuid,
          numericTournamentId
        );
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    updateTeam: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TeamParams;
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }

        const existing = await dbSvc.getTeamById(numericId);
        if (!existing) {
          res.status(404).json({ error: 'NOT_FOUND' });
          return;
        }

        const data = await dbSvc.updateTeam(numericId, req.body || {});
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    uploadLogo: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TeamParams;
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          res.status(400).json({ error: 'LOGO_REQUIRED' });
          return;
        }

        const data = await dbSvc.uploadLogo(numericId, req.body);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    getLogo: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TeamParams;
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }

        const logo = await dbSvc.getLogo(numericId);
        if (!logo) {
          res.status(404).json({ error: 'NOT_FOUND' });
          return;
        }

        res.set('Content-Type', 'image/png');
        res.send(logo);
      } catch (err) {
        next(err);
      }
    },
  };
};

export = teamsController;
