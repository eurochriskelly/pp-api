import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import serviceFactory from '../services/fixtures';
import mockServiceFactory from '../services/mocks/fixtures';

const teamScoreSchema = z
  .object({
    goals: z.number({ required_error: 'Goals are required' }),
    points: z.number({ required_error: 'Points are required' }),
    goalsExtra: z.number().nullable().optional(),
    pointsExtra: z.number().nullable().optional(),
    goalsPenalties: z.number().nullable().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const updateScoreSchema = z.object({
  scores: z.object(
    {
      team1: teamScoreSchema,
      team2: teamScoreSchema,
    },
    { required_error: 'scores object is required' }
  ),
  outcome: z
    .enum([
      'played',
      'in-progress',
      'not played',
      'skipped',
    ])
    .default('in-progress'),
});

const cardPlayerSchema = z
  .object({
    id: z.number().int().positive().nullable().optional(),
    team: z
      .string({ required_error: 'Team is required' })
      .min(1, { message: 'Team cannot be empty' }),
    cardColor: z.enum(['yellow', 'red', 'black'], {
      required_error: 'Card color is required',
      invalid_type_error: 'Invalid card color',
    }),
    playerNumber: z.number({ required_error: 'playerNumber is required' }),
    playerName: z.string({ required_error: 'playerName is required' }),
  })
  .passthrough();

const slackSchema = z.object({
  minutes: z.number({
    required_error: 'minutes is required',
    invalid_type_error: 'minutes must be a number',
  }),
});

const templateSetupSchema = z.object({
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  competitionRenames: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  teamRenames: z.array(z.object({
    competition: z.string(),
    groupNumber: z.number().int().nullable().optional(),
    from: z.string(),
    to: z.string(),
  })).optional(),
  groupRenames: z.array(z.object({
    competition: z.string(),
    from: z.number().int(),
    to: z.number().int().positive(),
  })).optional(),
}).refine(
  (data) => Boolean(
    data.scheduleDate ||
    data.scheduleTime ||
    data.competitionRenames?.length ||
    data.teamRenames?.length ||
    data.groupRenames?.length
  ),
  { message: 'At least one setup change is required' }
);

const fixtureDetailsSchema = z.object({
  field: z.enum(['category', 'team1', 'team2', 'umpireTeam', 'pitch', 'scheduledTime']),
  value: z.string().min(1),
});

const rescheduleSchema = z
  .object({
    placement: z.enum(['before', 'after'], {
      required_error: 'placement is required',
      invalid_type_error: 'placement must be before or after',
    }),
    targetPitch: z.string().optional(),
    targetFixtureId: z.number().int().positive().optional(),
    targetFixture: z.number().int().positive().optional(),
    relativeFixtureId: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      return !!(
        data.targetFixtureId ||
        data.targetFixture ||
        data.relativeFixtureId
      );
    },
    {
      message:
        'targetFixtureId (or targetFixture / relativeFixtureId) is required',
    }
  );

function fixturesController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc: any = factory(db);

  return {
    validateTsv: (req: Request, res: Response, next: NextFunction) => {
      try {
        const tsvEncoded =
          (req.body && (req.body.key || req.body.tsvEncoded)) || '';
        const { rows, warnings } = dbSvc.validateTsv(tsvEncoded);
        res.json({ data: { rows, warnings } });
      } catch (err) {
        next(err);
      }
    },

    updateCalculatedFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId: id } = req.params;
        const fixtures = await dbSvc.updateCalculatedFixtures(tournamentId, id);
        res.json({ data: fixtures });
      } catch (err) {
        next(err);
      }
    },

    getFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, pitch, category, outcome, order } = req.params;
        const fixtures = await dbSvc.getFixtures(tournamentId, {
          pitch,
          category,
          outcome,
          order,
});

        res.json({ data: fixtures });
      } catch (err) {
        next(err);
      }
    },

    getFilteredFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { Competitions, Pitches, Referee, Team } = req.body;
        const { tournamentId, outcome, order } = req.params;
        const fixtures = await dbSvc.getFilteredFixtures(tournamentId, {
          pitch: Pitches,
          category: Competitions,
          referee: Referee,
          team: Team,
          outcome,
          order,
        });
        res.json({ data: fixtures });
      } catch (err) {
        next(err);
      }
    },

    getFixture: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tournamentId = req.params.tournamentId;
        const fixtureId = req.params.fixtureId;
        const fixture = await dbSvc.getFixture(tournamentId, fixtureId);
        res.json({ data: fixture });
      } catch (err) {
        next(err);
      }
    },

    nextFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId } = req.params;
        const fixtures = await dbSvc.getNextFixtures(tournamentId);
        res.json({ data: fixtures });
      } catch (err) {
        next(err);
      }
    },

    rewindFixture: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId } = req.params;
        const result = await dbSvc.rewindLatestFixture(tournamentId);
        if (!result) {
          res.status(404).json({
            error: 'No started fixture found to rewind',
          });
          return;
        }
        const { id, category, stage } = result;
        res.json({
          message: `Removed score for category [${category}] fixture [${id}] stage [${stage}]`,
        });
      } catch (err: any) {
        if (err?.statusCode) {
          res.status(err.statusCode).json({
            error: err.code || 'REWIND_FAILED',
            message: err.message,
          });
          return;
        }
        next(err);
      }
    },

    startFixture: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { fixtureId } = req.params;
        const result = await dbSvc.startFixture(fixtureId);
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    endFixture: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { fixtureId } = req.params;
        const outcome = typeof req.body?.outcome === 'string' ? req.body.outcome : undefined;
        const result = await dbSvc.endFixture(fixtureId, outcome);
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    reschedule: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId } = req.params;

        const validationResult = rescheduleSchema.safeParse(req.body);
        if (!validationResult.success) {
          res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Invalid request body for reschedule',
            details: validationResult.error.flatten().fieldErrors,
          });
          return;
        }

        const { placement, targetPitch } = validationResult.data;
        const relativeFixtureId =
          validationResult.data.targetFixtureId ||
          validationResult.data.targetFixture ||
          validationResult.data.relativeFixtureId;
        const action = 'move';

        const data = {
          operation: 'reschedule',
          targetPitch,
          tournamentId: parseInt(tournamentId, 10),
          fixtureId: parseInt(fixtureId, 10),
          relativeFixtureId,
          placement,
          action,
        };

        const result = await dbSvc.reschedule(data);
        res.json({ data: result });
      } catch (err: any) {
        if (err?.statusCode) {
          res.status(err.statusCode).json({
            error: err.code || 'RESCHEDULE_FAILED',
            message: err.message,
          });
          return;
        }
        next(err);
      }
    },

    slack: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId } = req.params;

        const validationResult = slackSchema.safeParse(req.body);
        if (!validationResult.success) {
          res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Invalid request body for slack',
            details: validationResult.error.flatten().fieldErrors,
          });
          return;
        }

        const { minutes } = validationResult.data;

        const result = await dbSvc.slack({
          tournamentId: parseInt(tournamentId, 10),
          fixtureId: parseInt(fixtureId, 10),
          minutes,
        });
        res.json({ data: result });
      } catch (err: any) {
        if (err?.statusCode) {
          res.status(err.statusCode).json({
            error: err.code || 'SLACK_FAILED',
            message: err.message,
          });
          return;
        }
        next(err);
      }
    },

    updateTemplateSetup: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const parsed = templateSetupSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: 'INVALID_TEMPLATE_SETUP',
            message: 'Invalid schedule or naming setup',
            details: parsed.error.flatten().fieldErrors,
          });
          return;
        }
        const result = await dbSvc.updateTemplateSetup(
          parseInt(req.params.tournamentId, 10),
          parsed.data
        );
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    updateFixtureDetails: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const parsed = fixtureDetailsSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'INVALID_FIXTURE_DETAILS', message: 'A valid fixture field and value are required' });
          return;
        }
        const result = await dbSvc.updateFixtureDetails(
          parseInt(req.params.tournamentId, 10),
          parseInt(req.params.fixtureId, 10),
          parsed.data
        );
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    updateScore: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId } = req.params;

        const validationResult = updateScoreSchema.safeParse(req.body);
        if (!validationResult.success) {
          res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Invalid request body for updating score',
            details: validationResult.error.flatten().fieldErrors,
          });
          return;
        }

        const { scores, outcome } = validationResult.data;
        const { team1, team2 } = scores;
        await dbSvc.updateScore(tournamentId, fixtureId, team1, team2, outcome);
        res.json({ message: 'Score updated successfully' });
      } catch (err) {
        next(err);
      }
    },

    cardPlayers: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId } = req.params;

        const validationResult = cardPlayerSchema.safeParse(req.body);
        if (!validationResult.success) {
          res.status(400).json({
            message: 'Invalid request body for carding players.',
            errors: validationResult.error.flatten().fieldErrors,
          });
          return;
        }

        const validatedCardData = validationResult.data;
        const result = await dbSvc.cardPlayers(
          tournamentId,
          fixtureId,
          validatedCardData
        );
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },

    getCardedPlayers: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId } = req.params;
        if (!tournamentId) {
          res.status(400).json({ error: 'Tournament ID is required' });
          return;
        }
        const players = await dbSvc.getCardedPlayers(
          tournamentId,
          fixtureId ? parseInt(fixtureId, 10) : undefined
        );
        res.json(players);
      } catch (err) {
        next(err);
      }
    },

    deleteCard: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId, fixtureId, cardId } = req.params;

        const cardIdNum = parseInt(cardId, 10);
        if (isNaN(cardIdNum) || cardIdNum <= 0) {
          res.status(400).json({ error: 'Invalid Card ID format.' });
          return;
        }

        const result = await dbSvc.deleteCard(
          tournamentId,
          fixtureId,
          cardIdNum
        );

        if (result.cardDeleted) {
          res.status(200).json({
            message: `Card with ID ${cardIdNum} deleted successfully.`,
          });
        } else {
          res.status(404).json({
            error: `Card with ID ${cardIdNum} not found for the specified tournament/fixture.`,
          });
        }
      } catch (err) {
        next(err);
      }
    },

    copyFixtures: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { tournamentId } = req.params;
        const { sourceTournamentId, templateTeams = false, timeOffsetMinutes = 0 } = req.body;

        if (!sourceTournamentId || isNaN(parseInt(sourceTournamentId, 10))) {
          res.status(400).json({ error: 'sourceTournamentId is required' });
          return;
        }

        const result = await dbSvc.copyFixtures(
          parseInt(sourceTournamentId, 10),
          parseInt(tournamentId, 10),
          {
            templateTeams: templateTeams === true,
            timeOffsetMinutes: Number(timeOffsetMinutes) || 0,
          }
        );
        res.status(200).json({
          message: `Copied ${result.copied} fixtures`,
          data: result,
        });
      } catch (err: any) {
        if (err?.statusCode) {
          res.status(err.statusCode).json({
            error: err.code || 'COPY_FAILED',
            message: err.message,
          });
          return;
        }
        next(err);
      }
    },
  };
}

export = fixturesController;
