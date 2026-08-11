import { Request, Response } from 'express';
import {
  setPrintSqlStatements,
  getPrintSqlStatements,
} from '../services/system';

const API_CONTRACT_VERSION = '1.0.0';

const API_CAPABILITIES = {
  contractVersion: API_CONTRACT_VERSION,
  api: {
    name: 'PitchPerfect API',
  },
  output: {
    formats: ['json'],
    errors: {
      shape: '{ error, message, details? }',
      fixtureValidation: 'FIXTURE_VALIDATION_FAILED (HTTP 422)',
    },
  },
  workflows: {
    fixtureImport: {
      cli: {
        validate: 'ppx tournament load <tournamentId> --input-file <file>',
        apply:
          'ppx tournament load <tournamentId> --input-file <file> --confirmation-code <code>',
        verify: 'ppx tournament verify <tournamentId> --format json',
      },
      api: {
        validate: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/validate-tsv',
          body: '{ key: base64EncodedTsv }',
          response: '{ data: { valid, rows, warnings, errors, stages } }',
        },
        apply: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/fixtures',
          body: '{ key: base64EncodedTsv }',
          validates: 'The supplied TSV is revalidated by the API before mutation.',
          response:
            '{ data: { count, pitchCount, verification: { expectedFixtureCount, actualFixtureCount, verified } } }',
        },
        verify: {
          method: 'GET',
          endpoints: [
            {
              path: '/api/tournaments/{tournamentId}/fixtures',
              response: '{ data: Fixture[] }',
            },
            {
              path: '/api/tournaments/{tournamentId}/integrity-check',
              response: '{ data: IntegrityWarning[] }',
            },
          ],
          cliResponse: '{ fixtureCount, integrity: { clean, warnings } }',
        },
      },
      cliSafeguards: [
        'tournament load requires a locally generated confirmation code before apply.',
        'tournament verify combines the fixture list and integrity-check responses.',
      ],
      guarantees: [
        'Invalid TSV is rejected before mutation.',
        'Fixture replacement and count verification run in one database transaction.',
        'Raw JSON fixture arrays are rejected so imports cannot bypass TSV validation.',
      ],
    },
    fixtureMatchDay: {
      cli: {
        start: 'ppx fixture start <tournamentId> <fixtureId>',
        score:
          'ppx fixture score <tournamentId> <fixtureId> --home-points <points> --away-points <points>',
        finish: 'ppx fixture finish <tournamentId> <fixtureId>',
        rewind: 'ppx fixture rewind <tournamentId>',
        issueCard:
          'ppx fixture card <tournamentId> <fixtureId> --team <team> --player <name> --number <number> --type <yellow|red|black>',
      },
      api: {
        start: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/fixtures/{fixtureId}/start',
        },
        score: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/fixtures/{fixtureId}/score',
          body: '{ scores: { team1, team2 }, outcome? }',
        },
        finish: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/fixtures/{fixtureId}/end',
        },
        rewind: {
          method: 'PUT',
          path: '/api/tournaments/{tournamentId}/fixtures/rewind',
          behavior: 'Rewinds the latest started fixture; available before tournament start.',
        },
        issueCard: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/fixtures/{fixtureId}/carded',
          body: '{ team, playerName, playerNumber, cardColor }',
        },
      },
    },
    tournamentLifecycle: {
      cli: {
        publish: 'ppx tournament publish <tournamentId>',
        start: 'ppx tournament start <tournamentId>',
        close: 'ppx tournament close <tournamentId>',
        reset: 'ppx tournament reset <tournamentId> --confirmation-code <code>',
      },
      api: {
        transition: {
          method: 'PUT',
          path: '/api/tournaments/{tournamentId}/status',
          body: "{ status: 'published' | 'started' | 'closed' | 'in-design' | 'on-hold' }",
          validates: 'The API checks the authenticated organizer and valid lifecycle transition.',
        },
        reset: {
          method: 'POST',
          path: '/api/tournaments/{tournamentId}/reset',
          requires: ['Authenticated user'],
          behavior: 'Restores fixtures to planned schedules and clears scores/results.',
        },
      },
      cliSafeguards: [
        'tournament reset requires a locally generated confirmation code before mutation.',
      ],
    },
    squadManagement: {
      cli: {
        create:
          'ppx squad create <tournamentId> --name <name> [--category <category>] [--group <group>]',
        update: 'ppx squad update <tournamentId> <squadId> [--name <name>] [--category <category>]',
        delete: 'ppx squad delete <tournamentId> <squadId>',
        listPlayers: 'ppx squad players <tournamentId> <squadId>',
        addPlayer:
          'ppx squad add-player <tournamentId> <squadId> --first-name <name> --last-name <name>',
        removePlayer: 'ppx squad remove-player <tournamentId> <squadId> <playerId>',
      },
      api: {
        squads: {
          path: '/api/tournaments/{tournamentId}/squads',
          fields: ['teamName', 'groupLetter?', 'category?', 'teamSheetSubmitted?', 'notes?'],
        },
        players: {
          path: '/api/tournaments/{tournamentId}/squads/{squadId}/players',
          fields: ['firstName', 'secondName', 'dateOfBirth?', 'foirreannId?'],
          scope: 'The API verifies that the player belongs to the specified squad and tournament.',
        },
      },
    },
  },
} as const;

function systemController(db: any, useMock: boolean) {
  const database = process.env.PP_DATABASE || process.env.PP_DBN || 'unknown';

  return {
    enablePrintSqlStatements: (req: Request, res: Response): void => {
      setPrintSqlStatements(true);
      res.status(200).send('SQL statement printing enabled.');
    },

    disablePrintSqlStatements: (req: Request, res: Response): void => {
      setPrintSqlStatements(false);
      res.status(200).send('SQL statement printing disabled.');
    },

    getMode: (req: Request, res: Response): void => {
      res.json({
        mode: useMock ? 'mock' : 'database',
        useMock: useMock,
        database: database,
        timestamp: new Date().toISOString(),
        warning: useMock
          ? 'Running in MOCK MODE - all data stored in memory only!'
          : undefined,
      });
    },

    healthCheck: (req: Request, res: Response): void => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        printSql: getPrintSqlStatements(),
      });
    },

    getCapabilities: (req: Request, res: Response): void => {
      res.json({
        ...API_CAPABILITIES,
        runtime: {
          mode: useMock ? 'mock' : 'database',
          warning: useMock
            ? 'Mock mode is for development only; changes are not persistent.'
            : undefined,
        },
      });
    },
  };
}

export = systemController;
