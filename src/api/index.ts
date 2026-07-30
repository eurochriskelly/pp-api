import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import cors from 'cors';
import tournamentRoutes from './routes/tournaments';
import fixtureRoutes from './routes/tournaments/fixtures';
import tournamentTeamsRoutes from './routes/tournaments/teams';
import regionRoutes from './routes/regions';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import annualReportsRoutes from './routes/annual-reports';
import clubsRoutes from './routes/clubs';
import eventsRoutes from './routes/events';
import listingsRoutes from './routes/listings';
import usersRoutes from './routes/users';
import teamsRoutes from './routes/teams';
import seriesRoutes from './routes/series';
import championshipsRoutes from './routes/championships';
import rulesetsRoutes from './routes/rulesets';
import { II } from '../lib/logging';
import { validateTournamentIdentifier } from './middleware/validation';

interface Args {
  port: number;
  app: string;
  database: string;
  staticPath: string;
  useMock: boolean;
  errorMsg?: string;
}

interface Dbs {
  main?: any;
  club?: any;
}

const createApp = () => {
  const app = express();
  app.use(bodyParser.json());
  return app;
};

function setupApi(dbs: Dbs, ARGS: Args) {
  const app = createApp();

  const dbMain = dbs.main || dbs;
  const validateTournamentId = validateTournamentIdentifier(
    dbMain,
    ARGS.useMock
  );

  if (ARGS.errorMsg) {
    console.error(`Fatal error: ${ARGS.errorMsg}`);
    process.exit(1);
  }
  II(`Setting up API endpoints. Mock mode: ${ARGS.useMock}`);

  app.use(cors());
  app.use(morgan('dev', { skip: (req: Request) => req.path === '/health' }));

  app.use('/api/tournaments', tournamentRoutes(dbs, ARGS.useMock));
  app.use(
    '/api/tournaments/:tournamentId/fixtures',
    validateTournamentId,
    fixtureRoutes(dbs, ARGS.useMock)
  );
  app.use(
    '/api/tournaments/:tournamentId/teams',
    validateTournamentId,
    tournamentTeamsRoutes(dbs, ARGS.useMock)
  );
  app.use('/api/regions', regionRoutes(dbs, ARGS.useMock));
  app.use('/api/auth', authRoutes(dbs, ARGS.useMock));
  app.use('/auth', authRoutes(dbs, ARGS.useMock));
  app.use('/api/system', systemRoutes(dbs, ARGS.useMock));
  app.use('/api/clubs', clubsRoutes(dbs, ARGS.useMock));
  app.use('/api/annual-reports', annualReportsRoutes(dbs, ARGS.useMock));
  app.use('/api/teams', teamsRoutes(dbs, ARGS.useMock));
  app.use('/api/series', seriesRoutes(dbs, ARGS.useMock));
  app.use('/api/rulesets', rulesetsRoutes(dbs, ARGS.useMock));
  app.use('/api/championships', championshipsRoutes(dbs, ARGS.useMock));

  app.use('/api/events', eventsRoutes(dbs, ARGS.useMock));
  app.use('/api/listings', listingsRoutes(dbs, ARGS.useMock));
  app.use('/api', usersRoutes(dbs, ARGS.useMock));

  if (process.env.NODE_ENV !== 'production') {
    const internalRoutes = require('./routes/internal').default;
    app.use('/api/internal', internalRoutes(dbs, ARGS.useMock, true));
  }

  app.get('/health', (req: Request, res: Response) =>
    res.status(200).json({ status: 'ok' })
  );

  app.get('*', (req: Request, res: Response) => {
    res.status(404).send('Resourse not found!');
  });

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (
      err.message &&
      err.message.includes('Database connection is not available')
    ) {
      console.error(err.message);
      res.status(503).json({ error: err.message });
      return;
    }
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  const { port } = ARGS;
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on('error', (err: Error) => {
    console.error(`Server failed to start: ${err.message}`);
    process.exit(1);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.log('Forced shutdown');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export = setupApi;
