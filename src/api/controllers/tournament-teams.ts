import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/tournament-teams';
import mockServiceFactory from '../services/mocks/tournament-teams';

function tournamentTeamsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  const parseId = (value: string): number | null => {
    const id = parseInt(value, 10);
    return isNaN(id) ? null : id;
  };

  return {
    listTeams: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        if (tournamentId === null) {
          res.status(400).json({ error: 'Invalid tournament ID' });
          return;
        }

        const rows = await dbSvc.listTeams(tournamentId);
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },

    getTeamById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        const teamId = parseId(req.params.id);
        if (tournamentId === null || teamId === null) {
          res.status(400).json({ error: 'Invalid tournament ID or team ID' });
          return;
        }

        const row = await dbSvc.getTeamById(tournamentId, teamId);
        if (!row) {
          res.status(404).json({ error: 'Team not found' });
          return;
        }

        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    createTeam: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        if (tournamentId === null) {
          res.status(400).json({ error: 'Invalid tournament ID' });
          return;
        }

        const { entrantId } = req.body;
        if (!entrantId) {
          res.status(400).json({ error: 'entrantId is required' });
          return;
        }

        const row = await dbSvc.createTeam(tournamentId, req.body);
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateTeam: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        const teamId = parseId(req.params.id);
        if (tournamentId === null || teamId === null) {
          res.status(400).json({ error: 'Invalid tournament ID or team ID' });
          return;
        }

        const row = await dbSvc.updateTeam(tournamentId, teamId, req.body);
        res.json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteTeam: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        const teamId = parseId(req.params.id);
        if (tournamentId === null || teamId === null) {
          res.status(400).json({ error: 'Invalid tournament ID or team ID' });
          return;
        }

        const row = await dbSvc.deleteTeam(tournamentId, teamId);
        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    createSquad: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        const teamId = parseId(req.params.id);
        const squadSize = parseId(String(req.body.squadSize));

        if (tournamentId === null || teamId === null || squadSize === null) {
          res.status(400).json({ error: 'Invalid tournament ID, team ID or squadSize' });
          return;
        }

        if (squadSize <= 0) {
          res.status(400).json({ error: 'squadSize must be greater than 0' });
          return;
        }

        const row = await dbSvc.createSquad(tournamentId, teamId, squadSize);
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    assignPlayer: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = parseId(req.params.tournamentId);
        const fromTeamId = parseId(req.params.id);
        const playerId = parseId(req.params.playerId);
        const toTeamId = parseId(String(req.body.toTeamId));

        if (
          tournamentId === null ||
          fromTeamId === null ||
          playerId === null ||
          toTeamId === null
        ) {
          res.status(400).json({
            error: 'Invalid tournament ID, team IDs or player ID',
          });
          return;
        }

        const row = await dbSvc.assignPlayer(
          tournamentId,
          fromTeamId,
          toTeamId,
          playerId
        );
        res.json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },
  };
}

export = tournamentTeamsController;
