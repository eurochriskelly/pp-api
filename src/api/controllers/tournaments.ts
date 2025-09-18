import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/tournaments';
import mockServiceFactory from '../services/mocks/tournaments';

function prettyPrintStages(stages: any) {
  let output = '';
  for (const category in stages) {
    output += `\n"${category}":\n`;
    const { 'Group Stage': groupStage, 'Knockout Stage': knockoutStage } =
      stages[category];

    if (Object.keys(groupStage).length > 0) {
      output += `  Group Stage:\n`;
      for (const groupName in groupStage) {
        const group = groupStage[groupName];
        const groupHeader =
          `"${groupName}"`.padEnd(71) +
          `Size=${group.size}, Matches=${group.matchesCount}`;
        output += `    ${groupHeader}\n`;
        for (const match of group.matches) {
          output += `      ${match}\n`;
        }
      }
    }

    if (Object.keys(knockoutStage).length > 0) {
      output += `\n  Knockout Stage:\n`;
      for (const bracketName in knockoutStage) {
        const bracket = knockoutStage[bracketName];
        output += `    ${bracketName}:\n`;
        for (const match of bracket.matches) {
          output += `      ${match}\n`;
        }
      }
    }
  }
  console.log(output);
}

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
        const { rows, warnings, stages } = dbSvc.validateTsv(tsvEncoded);
        prettyPrintStages(stages);
        res.status(201).json({ data: { rows, warnings, stages } });
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
    getRecentMatches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getRecentMatches(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getTournamentCategories: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getTournamentCategories(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getGroupFixtures: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getGroupFixtures(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getGroupStandings: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getGroupStandings(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getKnockoutFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getKnockoutFixtures(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getFinalsResults: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getFinalsResults(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getAllMatches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const data = await dbSvc.getAllMatches(id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getMatchesByPitch: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getMatchesByPitch(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getCardedPlayers: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getCardedPlayers(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getSquads: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getSquads(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getSquad: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, id } = req.params as TournamentParams;
        const data = await dbSvc.getSquad(tournamentId, id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    updateSquad: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, id } = req.params as TournamentParams;
        await dbSvc.updateSquad(tournamentId, id, req.body);
        const squad = await dbSvc.getSquad(tournamentId, id);
        res.status(200).json(squad);
      } catch (err) {
        next(err);
      }
    },
    deleteSquad: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, id } = req.params as TournamentParams;
        await dbSvc.deleteSquad(tournamentId, id);
        res.json({ message: 'Squad deleted' });
      } catch (err) {
        next(err);
      }
    },
    createPlayer: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId } = req.params as TournamentParams;
        const playerId = await dbSvc.createPlayer(
          tournamentId,
          squadId,
          req.body
        );
        const player = await dbSvc.getPlayer(tournamentId, squadId, playerId);
        res.status(201).json(player);
      } catch (err) {
        next(err);
      }
    },
    getPlayers: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId } = req.params as TournamentParams;
        const data = await dbSvc.getPlayers(tournamentId, squadId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getPlayer: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId, id } = req.params as any;
        const data = await dbSvc.getPlayer(tournamentId, squadId, id);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    updatePlayer: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId, id } = req.params as any;
        await dbSvc.updatePlayer(tournamentId, squadId, id, req.body);
        const player = await dbSvc.getPlayer(tournamentId, squadId, id);
        res.status(200).json(player);
      } catch (err) {
        next(err);
      }
    },
    deletePlayer: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId, id } = req.params as any;
        await dbSvc.deletePlayer(tournamentId, squadId, id);
        res.json({ message: 'Player deleted' });
      } catch (err) {
        next(err);
      }
    },
    deleteFixtures: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        await dbSvc.deleteFixtures(id);
        res.json({ message: 'Fixtures deleted' });
      } catch (err) {
        next(err);
      }
    },
    deletePitches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        await dbSvc.deletePitches(id);
        res.json({ message: 'Pitches deleted' });
      } catch (err) {
        next(err);
      }
    },
    deleteCards: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        await dbSvc.deleteCards(id);
        res.json({ message: 'Cards deleted' });
      } catch (err) {
        next(err);
      }
    },
    createPitches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const pitches = await dbSvc.createPitches(id, req.body);
        res.status(201).json({ data: pitches });
      } catch (err) {
        next(err);
      }
    },
    createFixtures: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as TournamentParams;
        const fixtures = await dbSvc.createFixtures(id, req.body);
        res.status(201).json({ data: fixtures });
      } catch (err) {
        next(err);
      }
    },
  };
};
