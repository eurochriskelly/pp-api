import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';
import cors from 'cors';
import tournamentRoutes from './routes/tournaments';
import fixtureRoutes from './routes/tournaments/fixtures';
import tournamentTeamsRoutes from './routes/tournaments/teams';
import regionRoutes from './routes/regions';
import generalRoutes from './routes/general';
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
import tournamentControllerFactory from './controllers/tournaments';
import clubsControllerFactory from './controllers/clubs';
import teamsControllerFactory from './controllers/teams';
import authMiddlewareFactory from './middleware/auth';

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

  // Handle dbs being just a single connection object (backward compatibility) or { main, club }
  const dbMain = dbs.main || dbs;

  if (ARGS.errorMsg) {
    console.error(`Fatal error: ${ARGS.errorMsg}`);
    process.exit(1);
  }
  II(`Setting up API endpoints. Mock mode: ${ARGS.useMock}`);

  // Define PDF upload route BEFORE global JSON parsing (but after db is available)
  app.post(
    '/api/tournaments/:tournamentId/club/:clubId/teamsheet',
    bodyParser.raw({ type: 'application/pdf', limit: '10mb' }),
    (req: Request, res: Response) => {
      console.log(
        'Teamsheet route hit:',
        req.params,
        'Body type:',
        typeof req.body,
        'Body length:',
        req.body ? (req.body as Buffer).length : 'null'
      );
      try {
        const ctrl = tournamentControllerFactory(dbMain, ARGS.useMock);
        ctrl.uploadTeamsheet(req, res, ((err: any) => {
          if (err) {
            console.error('Teamsheet upload error: ', err);
            res.status(500).json({ error: err.message });
          }
        }) as any);
      } catch (error) {
        console.error('Teamsheet route error: ', error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  // Club logo upload route - must be defined before JSON parser to handle binary data
  const auth = authMiddlewareFactory(dbMain, ARGS.useMock);
  app.post(
    '/api/clubs/:id/logo',
    auth,
    bodyParser.raw({ type: 'image/*', limit: '5mb' }),
    (req: Request, res: Response) => {
      console.log(
        'Club logo upload route hit:',
        req.params,
        'Body type:',
        typeof req.body,
        'Body length:',
        req.body ? (req.body as Buffer).length : 'null'
      );
      try {
        const ctrl = clubsControllerFactory(dbMain, ARGS.useMock);
        ctrl.uploadLogo(req, res, ((err: any) => {
          if (err) {
            console.error('Logo upload error: ', err);
            res.status(500).json({ error: err.message });
          }
        }) as any);
      } catch (error) {
        console.error('Logo upload route error: ', error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  app.post(
    '/api/teams/:id/logo',
    auth,
    bodyParser.raw({ type: 'image/png', limit: '5mb' }),
    (req: Request, res: Response) => {
      try {
        const ctrl = teamsControllerFactory(dbMain, ARGS.useMock);
        ctrl.uploadLogo(req, res, ((err: any) => {
          if (err) {
            console.error('Team logo upload error: ', err);
            res.status(500).json({ error: err.message });
          }
        }) as any);
      } catch (error) {
        console.error('Team logo upload route error: ', error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  app.use(cors());
  app.use(morgan('dev', { skip: (req: Request) => req.path === '/health' }));

  // Direct endpoint (unchanged)
  app.post('/api/upload', (req: Request, res: Response) => {
    parseFormData(req, res, (filePath: string) => {
      fs.readFile(filePath, 'utf8', (err: Error | null, data: string) => {
        if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');
        }
        console.log('File contents:', data);
        res.send('File received and contents logged.');
      });
    });
  });

  app.use('/api/tournaments', tournamentRoutes(dbMain, ARGS.useMock));
  app.use(
    '/api/tournaments/:tournamentId/fixtures',
    fixtureRoutes(dbMain, ARGS.useMock)
  );
  app.use(
    '/api/tournaments/:tournamentId/teams',
    tournamentTeamsRoutes(dbMain, ARGS.useMock)
  );
  app.use('/api/regions', regionRoutes(dbMain, ARGS.useMock));
  app.use('/api', generalRoutes(dbMain, ARGS.useMock));
  app.use('/api/auth', authRoutes(dbMain, ARGS.useMock));
  app.use('/auth', authRoutes(dbMain, ARGS.useMock));
  app.use('/api/system', systemRoutes(dbMain, ARGS.useMock));
  app.use('/api/clubs', clubsRoutes(dbMain, ARGS.useMock));
  app.use('/api/annual-reports', annualReportsRoutes(dbMain, ARGS.useMock));
  app.use('/api/teams', teamsRoutes(dbMain, ARGS.useMock));
  app.use('/api/series', seriesRoutes(dbMain, ARGS.useMock));
  app.use('/api/rulesets', rulesetsRoutes(dbMain, ARGS.useMock));
  app.use('/api/championships', championshipsRoutes(dbMain, ARGS.useMock));

  // New schemas
  app.use('/api/events', eventsRoutes(dbs, ARGS.useMock));
  app.use('/api/listings', listingsRoutes(dbs, ARGS.useMock));
  app.use('/api', usersRoutes(dbMain, ARGS.useMock));

  // Internal/test-only endpoints (dev/test environments only)
  if (process.env.NODE_ENV !== 'production') {
    const internalRoutes = require('./routes/internal').default;
    app.use('/api/internal', internalRoutes(dbMain, ARGS.useMock, true));
  }

  app.get('/health', (req: Request, res: Response) =>
    res.status(200).json({ status: 'ok' })
  );

  app.get('*', (req: Request, res: Response) => {
    res.status(404).send('Resourse not found!');
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force shutdown after 5 seconds
    setTimeout(() => {
      console.log('Forced shutdown');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

function parseFormData(
  req: Request,
  res: Response,
  callback: (filePath: string) => void
) {
  const contentType = req.headers['content-type'];
  if (!contentType) {
    return res.status(400).send('Content-Type header missing');
  }
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) {
    return res.status(400).send('Boundary not found in Content-Type');
  }
  let data = '';
  req.on('data', (chunk: Buffer) => (data += chunk.toString()));
  req.on('end', () => {
    const parts = data.split('--' + boundary);
    parts.forEach((part: string) => {
      if (part.includes('Content-Disposition')) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          const filename = filenameMatch[1];
          const fileContent = part.split('\r\n\r\n')[1].split('\r\n--')[0];
          const filePath = path.join(__dirname, 'uploads', filename);
          fs.writeFileSync(filePath, fileContent);
          callback(filePath);
        }
      }
    });
  });
}

export = setupApi;
