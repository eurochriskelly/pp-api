import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/tournaments';
import mockServiceFactory from '../services/mocks/tournaments';
import { createTournamentReportCache } from '../services/tournaments/report-cache';

function flattenValidatedRows(rows: any[]): Record<string, string | number>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, cell]) => [key, (cell as any).value])
    )
  );
}

function normalizeFixtureImportInput(dbSvc: any, body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return flattenValidatedRows(dbSvc.validateTsv(body.toString('base64')).rows);
  }

  let tsvText: string | null = null;

  if (typeof body === 'string') {
    tsvText = body;
  } else if (body && typeof body === 'object') {
    const payload = body as { tsv?: unknown; key?: unknown; tsvEncoded?: unknown };

    if (typeof payload.tsv === 'string') {
      tsvText = payload.tsv;
    } else if (typeof payload.key === 'string') {
      return flattenValidatedRows(dbSvc.validateTsv(payload.key).rows);
    } else if (typeof payload.tsvEncoded === 'string') {
      return flattenValidatedRows(dbSvc.validateTsv(payload.tsvEncoded).rows);
    }
  }

  if (typeof tsvText === 'string') {
    const tsvEncoded = Buffer.from(tsvText, 'utf8').toString('base64');
    return flattenValidatedRows(dbSvc.validateTsv(tsvEncoded).rows);
  }

  throw new Error(
    'Unsupported fixtures import body. Expected TSV text, base64 TSV, or an array of fixture rows.'
  );
}

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
  tournamentId: string;
  uuid?: string;
  status: string;
  squadId: string;
  code: string;
  playerId: string;
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

type AuthenticatedRequest = Request & {
  user?: {
    id?: number | string;
    [key: string]: any;
  };
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function tournamentsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc: any = factory(db);
  const reportCache = createTournamentReportCache({
    db,
    dbSvc,
    enabled: !useMock && !!db,
  });
  reportCache.start();

  const resolveTournamentId = async (
    identifier: string
  ): Promise<number | null> => {
    if (isUuid(identifier)) {
      const tournament = await dbSvc.getTournament(undefined, identifier);
      return tournament?.id ?? null;
    }
    const numericId = parseInt(identifier, 10);
    return isNaN(numericId) ? null : numericId;
  };

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

    createTournament: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
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
          championshipId,
          roundNumber,
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
          championshipId,
          roundNumber,
          winPoints,
          drawPoints,
          lossPoints,
        });
        res.status(201).json(tournament);
      } catch (err) {
        next(err);
      }
    },

    publishTournamentArchive: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const submittedByUserId = req.user?.id;
        if (!submittedByUserId) {
          res.status(401).json({ error: 'UNAUTHORIZED' });
          return;
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          res.status(400).json({
            error: 'PPP_FILE_REQUIRED',
            message: 'Request body must contain a .ppp archive.',
          });
          return;
        }

        const softwareVersionHeader = req.headers['x-pp-software-version'];
        const softwareVersion =
          typeof softwareVersionHeader === 'string'
            ? softwareVersionHeader
            : undefined;

        const result = await dbSvc.publishTournamentArchive({
          archiveBuffer: req.body,
          submittedByUserId,
          softwareVersion,
        });

        res.status(201).json({
          data: {
            id: result.id,
            eventUuid: result.eventUuid,
            tournamentId: result.tournamentId,
          },
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_PPP_ARCHIVE') {
          res.status(400).json({
            error: 'INVALID_PPP_ARCHIVE',
            message:
              'Invalid .ppp archive. Expected a ZIP containing tournament.json.',
          });
          return;
        }
        next(err);
      }
    },

    updateTournament: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const {
          region,
          title,
          date,
          location,
          lat,
          lon,
          codeOrganizer,
          championshipId,
          roundNumber,
          winPoints = 2,
          drawPoints = 1,
          lossPoints = 0,
        } = req.body;
        await dbSvc.updateTournament(tournamentId, {
          region,
          title,
          date,
          location,
          lat,
          lon,
          codeOrganizer,
          championshipId,
          roundNumber,
          winPoints,
          drawPoints,
          lossPoints,
        });
        const tournament = await dbSvc.getTournament(tournamentId);
        res.status(200).json(tournament);
      } catch (err) {
        next(err);
      }
    },

    updateTournamentStatus: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId, status } = req.params as TournamentParams;
        await dbSvc.updateTournamentStatus(parseInt(tournamentId, 10), status);
        const tournament = await dbSvc.getTournament(tournamentId);
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

    getTournamentReport: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId: tournamentIdParam } =
          req.params as TournamentParams;
        const { category } = req.query as { category?: string };
        const tournamentId = await resolveTournamentId(tournamentIdParam);
        if (!tournamentId) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const report = await dbSvc.buildTournamentReport(
          tournamentId,
          category
        );
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },
    getTournamentReportCache: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId: tournamentIdParam } =
          req.params as TournamentParams;
        const { lastUpdate } = req.query as { lastUpdate?: string };
        const tournamentId = await resolveTournamentId(tournamentIdParam);
        if (!tournamentId) {
          res.status(404).json({
            error: 'TOURNAMENT_NOT_FOUND',
            message: 'Tournament not found.',
          });
          return;
        }
        const cacheResult = reportCache.get(tournamentId, lastUpdate || null);

        switch (cacheResult.state) {
          case 'hit':
            res.json({ data: cacheResult.payload });
            return;
          case 'unchanged':
            res.json({ data: cacheResult.payload });
            return;
          case 'warming':
            res.setHeader('Retry-After', String(cacheResult.retryAfter));
            res.status(503).json({
              error: 'CACHE_WARMING',
              message: cacheResult.message,
              retryAfter: cacheResult.retryAfter,
            });
            return;
          case 'error':
            res.setHeader('Retry-After', String(cacheResult.retryAfter));
            res.status(503).json({
              error: 'CACHE_ERROR',
              message: cacheResult.message,
              retryAfter: cacheResult.retryAfter,
            });
            return;
          case 'disabled':
            res.status(503).json({
              error: 'CACHE_DISABLED',
              message: cacheResult.message,
            });
            return;
          default:
            res.status(500).json({
              error: 'CACHE_UNKNOWN_STATE',
              message: 'Unknown tournament report cache state encountered.',
            });
        }
      } catch (err) {
        next(err);
      }
    },

    buildTournamentReport: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId: tournamentIdParam } =
          req.params as TournamentParams;
        const tournamentId = await resolveTournamentId(tournamentIdParam);
        if (!tournamentId) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const report = await dbSvc.buildTournamentReport(tournamentId);
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },

    generateFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const competitionData = req.body;
        const hydratedCompetition =
          await dbSvc.generateFixtures(competitionData);
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

    getTournamentClubs: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const numericTournamentId = parseInt(tournamentId, 10);
        if (isNaN(numericTournamentId)) {
          res.status(400).json({ error: 'INVALID_TOURNAMENT_ID' });
          return;
        }

        const data = await dbSvc.getTournamentClubs(numericTournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    getTournament: async (req: Request, res: Response) => {
      const { tournamentId, uuid } = req.params as TournamentParams & {
        uuid?: string;
      };
      const tournament = await dbSvc.getTournament(tournamentId, uuid);
      res.json({ data: tournament });
    },

    deleteTournament: async (req: Request, res: Response) => {
      const { tournamentId } = req.params as TournamentParams;
      await dbSvc.deleteTournament(tournamentId);
      res.json({ message: 'Tournament deleted' });
    },

    resetTournament: async (req: Request, res: Response) => {
      const { tournamentId } = req.params as TournamentParams;
      try {
        await dbSvc.resetTournament(tournamentId);
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
      const { teamName, groupLetter, category, teamSheetSubmitted, notes } =
        req.body;
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
      const { tournamentId, code } = req.params as TournamentParams;
      const { role } = req.query as TournamentQuery;
      try {
        const result = await dbSvc.codeCheck(
          tournamentId,
          code.toUpperCase(),
          role
        );
        res.status(200).json({
          authorized: result,
          data: { role, tournamentId },
        });
      } catch (err: any) {
        res.status(400).json({
          authorized: false,
          data: { role, tournamentId },
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
    getRecentMatches: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getRecentMatches(tournamentId);
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
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getTournamentCategories(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getGroupFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getGroupFixtures(tournamentId);
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
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getGroupStandings(tournamentId);
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
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getKnockoutFixtures(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getFinalsResults: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getFinalsResults(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    getAllMatches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getAllMatches(tournamentId);
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
    getCardedPlayers: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getCardedPlayers(tournamentId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    getTournamentOverview: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const data = await dbSvc.getTournamentOverview(tournamentId);
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
        const { tournamentId, squadId } = req.params as TournamentParams;
        const data = await dbSvc.getSquad(tournamentId, squadId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    updateSquad: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId } = req.params as TournamentParams;
        await dbSvc.updateSquad(tournamentId, squadId, req.body);
        const squad = await dbSvc.getSquad(tournamentId, squadId);
        res.status(200).json(squad);
      } catch (err) {
        next(err);
      }
    },
    deleteSquad: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId } = req.params as TournamentParams;
        await dbSvc.deleteSquad(tournamentId, squadId);
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
        const { tournamentId, squadId, playerId } = req.params as any;
        const data = await dbSvc.getPlayer(tournamentId, squadId, playerId);
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
    updatePlayer: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId, playerId } = req.params as any;
        await dbSvc.updatePlayer(tournamentId, squadId, playerId, req.body);
        const player = await dbSvc.getPlayer(tournamentId, squadId, playerId);
        res.status(200).json(player);
      } catch (err) {
        next(err);
      }
    },
    deletePlayer: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, squadId, playerId } = req.params as any;
        await dbSvc.deletePlayer(tournamentId, squadId, playerId);
        res.json({ message: 'Player deleted' });
      } catch (err) {
        next(err);
      }
    },

    integrityCheck: async (req: Request, res: Response, next: NextFunction) => {
      try {
        console.log('icheck');
        const { tournamentId } = req.params as TournamentParams;
        const result = await dbSvc.integrityCheck(parseInt(tournamentId, 10));
        res.json(result);
      } catch (err) {
        next(err);
      }
    },

    deleteFixtures: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        await dbSvc.deleteFixtures(tournamentId);
        res.json({ message: 'Fixtures deleted' });
      } catch (err) {
        next(err);
      }
    },
    deletePitches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        await dbSvc.deletePitches(tournamentId);
        res.json({ message: 'Pitches deleted' });
      } catch (err) {
        next(err);
      }
    },
    deleteCards: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        await dbSvc.deleteCards(tournamentId);
        res.json({ message: 'Cards deleted' });
      } catch (err) {
        next(err);
      }
    },
    createPitches: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const pitches = await dbSvc.createPitches(tournamentId, req.body);
        res.status(201).json({ data: pitches });
      } catch (err) {
        next(err);
      }
    },
    createFixtures: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const fixtureRows = normalizeFixtureImportInput(dbSvc, req.body);
        const fixtures = await dbSvc.createFixtures(tournamentId, fixtureRows);
        res.status(201).json({ data: fixtures });
      } catch (err) {
        next(err);
      }
    },

    getOrganizers: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId } = req.params as TournamentParams;
        const organizers = await dbSvc.getOrganizers(tournamentId);
        res.json({ data: organizers });
      } catch (err) {
        next(err);
      }
    },

    assignOrganizer: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId, userId } = req.params as TournamentParams & {
          userId: string;
        };
        await dbSvc.assignOrganizer(tournamentId, userId);
        res.status(200).json({ message: 'Organizer assigned successfully' });
      } catch (err) {
        next(err);
      }
    },

    uploadTeamsheet: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const { tournamentId, clubId } = req.params as TournamentParams & {
          clubId: string;
        };
        const result = await dbSvc.uploadTeamsheet(
          tournamentId,
          parseInt(clubId),
          req.body
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },

    getClubLogo: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tournamentId, clubId } = req.params as TournamentParams & {
          clubId: string;
        };
        const logo = await dbSvc.getClubLogo(tournamentId, parseInt(clubId));
        if (logo) {
          res.set('Content-Type', 'image/png');
          res.send(logo);
        } else {
          res.status(404).json({ error: 'Logo not found' });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}

export = tournamentsController;
