import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import cors from 'cors';
import tournamentRoutes from './routes/tournaments';
import fixtureRoutes from './routes/tournaments/fixtures';
import tournamentTeamsRoutes from './routes/tournaments/teams';
import teamAllocationRoutes from './routes/tournaments/team-allocations';
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
  database: string;
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

function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  next();
}

function createRateLimiter(windowMs: number, maxRequests: number) {
  const requests = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = requests.get(key) || [];
    const recent = timestamps.filter((t) => t > windowStart);
    if (recent.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }
    recent.push(now);
    requests.set(key, recent);
    next();
  };
}

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

  app.use(securityHeaders);

  const allowedOrigins = process.env.PP_ALLOWED_ORIGINS
    ? process.env.PP_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : true;
  if (process.env.NODE_ENV === 'production' && allowedOrigins === true) {
    console.warn(
      '⚠️  Production CORS is wide-open because PP_ALLOWED_ORIGINS is not set'
    );
  }
  const corsOptions: cors.CorsOptions = {
    origin: allowedOrigins,
    credentials: true,
  };
  app.use(cors(corsOptions));
  app.use(morgan('dev', { skip: (req: Request) => req.path === '/health' }));

  const authLimiter = createRateLimiter(15 * 60 * 1000, 50);

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
  app.use(
    '/api/tournaments/:tournamentId/team-allocations',
    validateTournamentId,
    teamAllocationRoutes(dbs, ARGS.useMock)
  );
  app.use('/api/auth', authLimiter, authRoutes(dbs, ARGS.useMock));
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
    res.status(404).send('Resource not found!');
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
