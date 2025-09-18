import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/tournaments';
import mockServiceFactory from '../services/mocks/tournaments';

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
  region?: string;
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
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc: any = factory(db);



  return {
    // Tournament CRUD
    validateTsv: (req: Request, res: Response, next: NextFunction) => {
      try {
        const tsvEncoded = req.body.key;
        const { rows, warnings } = dbSvc.validateTsv(tsvEncoded);
        res.status(201).json({ data: { rows, warnings } });
      } catch (err) {
        next(err);
      }
    },

    createTournament: async (req: Request, res: Response, next: NextFunction) => {
      try {
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
        res.status(201).json(tournament);
      } catch (err) {
        next(err);
      }
    },

    updateTournament: async (req: Request, res: Response, next: NextFunction) => {
      try {
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
        res.status(200).json(tournament);
      } catch (err) {
        next(err);
      }
    },

    getTournaments: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const status = (req.query as TournamentQuery).status || 'all';
        const userId = (req.query as TournamentQuery).userId;
        const role = (req.query as TournamentQuery).role;
        const tournaments = await dbSvc.getTournaments(status, userId, role);
        res.json({ data: tournaments });
      } catch (err) {
        next(err);
      }
    },

    getTournamentReport: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const report = await dbSvc.buildTournamentReport(id);
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },

    buildTournamentReport: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const report = await dbSvc.buildTournamentReport(id);
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },

    generateFixtures: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const competitionData = req.body;
        const hydratedCompetition = await dbSvc.generateFixtures(
          competitionData
        );
        res.status(200).json({ data: hydratedCompetition });
      } catch (err) {
        next(err);
      }
    },

    getFilters: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const { role, category } = req.query as TournamentQuery;
        if (!role) {
          const err = new Error('Role query parameter is required.');
          (err as any).statusCode = 400;
          throw err;
        }
        const filters = await dbSvc.getFilters(tournamentId, role, category);
        res.json({ data: filters });
      } catch (err) {
        next(err);
      }
    },

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

    getTournamentsByStatus: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { status } = req.params as TournamentParams;
        const { userId, region } = req.query as TournamentQuery;
        const tournaments = await dbSvc.getTournamentsByStatus(
          status,
          userId,
          region
        );
        res.json({ data: tournaments });
      } catch (err) {
        next(err);
      }
    },

    getTournamentsSummary: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const summary = await dbSvc.getTournamentsSummary();
        res.json({ data: summary });
      } catch (err) {
        next(err);
      }
    },
    getRecentMatches: async (req: Request, res: Response, next: NextFunction) => {},
    getTournamentCategories: async (req: Request, res: Response, next: NextFunction) => {},
    getGroupFixtures: async (req: Request, res: Response, next: NextFunction) => {},
    getGroupStandings: async (req: Request, res: Response, next: NextFunction) => {},
    getKnockoutFixtures: async (req: Request, res: Response, next: NextFunction) => {},
    getFinalsResults: async (req: Request, res: Response, next: NextFunction) => {},
    getAllMatches: async (req: Request, res: Response, next: NextFunction) => {},
    getMatchesByPitch: async (req: Request, res: Response, next: NextFunction) => {},
    getCardedPlayers: async (req: Request, res: Response, next: NextFunction) => {},
    getSquads: async (req: Request, res: Response, next: NextFunction) => {},
    getSquad: async (req: Request, res: Response, next: NextFunction) => {},
    updateSquad: async (req: Request, res: Response, next: NextFunction) => {},
    deleteSquad: async (req: Request, res: Response, next: NextFunction) => {},
    createPlayer: async (req: Request, res: Response, next: NextFunction) => {},
    getPlayers: async (req: Request, res: Response, next: NextFunction) => {},
    getPlayer: async (req: Request, res: Response, next: NextFunction) => {},
    updatePlayer: async (req: Request, res: Response, next: NextFunction) => {},
    deletePlayer: async (req: Request, res: Response, next: NextFunction) => {},
    deleteFixtures: async (req: Request, res: Response, next: NextFunction) => {},
    deletePitches: async (req: Request, res: Response, next: NextFunction) => {},
    deleteCards: async (req: Request, res: Response, next: NextFunction) => {},
    createPitches: async (req: Request, res: Response, next: NextFunction) => {},
    createFixtures: async (req: Request, res: Response, next: NextFunction) => {},
  };
};
