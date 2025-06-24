import { Request, Response, NextFunction } from 'express';
import { TournamentService } from '../services/tournaments';
import { MockTournamentService } from '../services/mocks/tournaments';

type TournamentParams = {
  id: string;
  tournamentId: string;
  uuid?: string;
  status: string;
  squadId: string;
  code: string;
};

type TournamentQuery = {
  status?: string;
  userId?: string;
  role?: string;
  category?: string;
};

type TournamentBody = {
  userId?: string;
  region?: string;
  title?: string;
  date?: string;
  location?: string;
  lat?: number;
  lon?: number;
  codeOrganizer?: string;
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  teamName?: string;
  groupLetter?: string;
  category?: string;
  teamSheetSubmitted?: boolean;
  notes?: string;
  firstName?: string;
  secondName?: string;
  dateOfBirth?: string;
  foirreannId?: number;
  key?: string;
};

export default (db: any, useMock: boolean) => {
  const serviceFactory = useMock
    ? require('../services/mocks/tournaments')
    : require('../services/tournaments');
  const dbSvc: TournamentService | MockTournamentService = serviceFactory(db);

  const handleRoute = (
    logic: (req: Request, res: Response, next: NextFunction) => Promise<any>,
    successStatus = 200
  ) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await logic(req, res, next);
        if (result !== undefined) {
          return res.status(successStatus).json(result);
        }
      } catch (err) {
        return next(err);
      }
    };
  };

  return {
    // Tournament CRUD
    validateTsv: handleRoute(async (req: Request, res: Response) => {
      const tsvEncoded = req.body.key;
      const { rows, warnings } = dbSvc.validateTsv(tsvEncoded);
      return { data: { rows, warnings } };
    }, 201),

    createTournament: handleRoute(async (req: Request) => {
      const {
        userId,
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints = 2,
        drawPoints = 1,
        lossPoints = 0,
      } = req.body;
      const tournament = await dbSvc.createTournament(userId, {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints,
        drawPoints,
        lossPoints,
      });
      return tournament;
    }, 201),

    updateTournament: handleRoute(async (req: Request) => {
      const { id } = req.params as TournamentParams;
      const {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints = 2,
        drawPoints = 1,
        lossPoints = 0,
      } = req.body;
      await dbSvc.updateTournament(id, {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints,
        drawPoints,
        lossPoints,
      });
      const tournament = await dbSvc.getTournament(id);
      return tournament;
    }, 200),

    getTournaments: handleRoute(async (req: Request) => {
      const status = (req.query as TournamentQuery).status || 'all';
      const userId = (req.query as TournamentQuery).userId;
      const role = (req.query as TournamentQuery).role;
      const tournaments = await dbSvc.getTournaments(status, userId, role);
      return { data: tournaments };
    }),

    getTournamentReport: handleRoute(async (req: Request) => {
      const { id } = req.params as TournamentParams;
      const report = await dbSvc.buildTournamentReport(id);
      return { data: report };
    }),

    buildTournamentReport: handleRoute(async (req: Request) => {
      const { id } = req.params as TournamentParams;
      const report = await dbSvc.buildTournamentReport(id);
      return { data: report };
    }),

    generateFixtures: handleRoute(async (req: Request) => {
      const competitionData = req.body;
      const hydratedCompetition = await dbSvc.generateFixtures(competitionData);
      return { data: hydratedCompetition };
    }, 200),

    getFilters: handleRoute(async (req: Request) => {
      const { tournamentId } = req.params as TournamentParams;
      const { role, category } = req.query as TournamentQuery;
      if (!role) {
        const err = new Error('Role query parameter is required.');
        (err as any).statusCode = 400;
        throw err;
      }
      const filters = await dbSvc.getFilters(tournamentId, role, category);
      return { data: filters };
    }),

    getTournament: async (req: Request, res: Response) => {
      const { id, uuid } = req.params as TournamentParams;
      const tournament = await dbSvc.getTournament(id, uuid);
      res.json({ data: tournament });
    },

    deleteTournament: async (req: Request, res: Response) => {
      const { id } = req.params as TournamentParams;
      await dbSvc.deleteTournament(id);
      res.json({ message: 'Tournament deleted' });
    },

    resetTournament: async (req: Request, res: Response) => {
      const { id } = req.params as TournamentParams;
      try {
        await dbSvc.resetTournament(id);
        res.json({ message: 'Tournament reset successfully' });
      } catch (err) {
        console.log(err);
        res.status(403).json({
          message:
            'Only sandbox tournament (id=1) can be reset. See log for more info.',
        });
      }
    },

    // ... (rest of the controller methods with similar type annotations)

    // Squads CRUD
    createSquad: async (req: Request, res: Response) => {
      const { tournamentId } = req.params as TournamentParams;
      const { teamName, groupLetter, category, teamSheetSubmitted, notes } = req.body;
      const id = await dbSvc.createSquad(tournamentId, {
        teamName,
        groupLetter,
        category,
        teamSheetSubmitted,
        notes,
      });
      const squad = await dbSvc.getSquad(tournamentId, id);
      res.status(201).json(squad);
    },

    // ... (other squad and player methods with similar type annotations)

    codeCheck: async (req: Request, res: Response) => {
      const { id, code } = req.params as TournamentParams;
      const { role } = req.query as TournamentQuery;
      try {
        const result = await dbSvc.codeCheck(id, code.toUpperCase(), role);
        res.status(200).json({
          authorized: result,
          data: { role, tournamentId: id },
        });
      } catch (err: any) {
        res.status(400).json({
          authorized: false,
          data: { role, tournamentId: id },
          error:
            err.message ||
            'Invalid code or internal server error while checking pin code',
          warnings: err.warnings || undefined,
        });
      }
    },

    getTournamentsByStatus: handleRoute(async (req: Request) => {
      const { status } = req.params as TournamentParams;
      const { userId, region } = req.query as TournamentQuery;
      const tournaments = await dbSvc.getTournamentsByStatus(
        status,
        userId,
        region
      );
      return { data: tournaments };
    }),

    getTournamentsSummary: handleRoute(async () => {
      const summary = await dbSvc.getTournamentsSummary();
      return { data: summary };
    }),
  };
};
