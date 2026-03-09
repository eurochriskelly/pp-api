const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const cors = require('cors');
const tournamentRoutes = require('./routes/tournaments').default;
const fixtureRoutes = require('./routes/tournaments/fixtures');
const regionRoutes = require('./routes/regions');
const generalRoutes = require('./routes/general');
const authRoutes = require('./routes/auth');
const systemRoutes = require('./routes/system');
const annualReportsRoutes = require('./routes/annual-reports');
const clubsRoutes = require('./routes/clubs');
const eventsRoutes = require('./routes/events');
const listingsRoutes = require('./routes/listings');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams').default;
const { II } = require('../lib/logging'); // Import the logger

const createApp = () => {
  const app = express();
  app.use(bodyParser.json());
  return app;
};

module.exports = (dbs, ARGS) => {
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
    (req, res) => {
      console.log(
        'Teamsheet route hit:',
        req.params,
        'Body type:',
        typeof req.body,
        'Body length:',
        req.body ? req.body.length : 'null'
      );
      try {
        // Import controller dynamically to avoid circular dependencies
        const tournamentController = require('./controllers/tournaments');
        const ctrl = tournamentController.default(dbMain, ARGS.useMock);
        ctrl.uploadTeamsheet(req, res, (err) => {
          if (err) {
            console.error('Teamsheet upload error: ', err);
            res.status(500).json({ error: err.message });
          }
        });
      } catch (error) {
        console.error('Teamsheet route error: ', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Club logo upload route - must be defined before JSON parser to handle binary data
  const authMiddlewareFactory = require('./middleware/auth');
  const auth = authMiddlewareFactory(dbMain, ARGS.useMock);
  app.post(
    '/api/clubs/:id/logo',
    auth,
    bodyParser.raw({ type: 'image/*', limit: '5mb' }),
    (req, res) => {
      console.log(
        'Club logo upload route hit:',
        req.params,
        'Body type:',
        typeof req.body,
        'Body length:',
        req.body ? req.body.length : 'null'
      );
      try {
        const clubsController = require('./controllers/clubs');
        const ctrl = clubsController(dbMain, ARGS.useMock);
        ctrl.uploadLogo(req, res, (err) => {
          if (err) {
            console.error('Logo upload error: ', err);
            res.status(500).json({ error: err.message });
          }
        });
      } catch (error) {
        console.error('Logo upload route error: ', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    '/api/teams/:id/logo',
    auth,
    bodyParser.raw({ type: 'image/png', limit: '5mb' }),
    (req, res) => {
      try {
        const teamsController = require('./controllers/teams');
        const ctrl = teamsController.default(dbMain, ARGS.useMock);
        ctrl.uploadLogo(req, res, (err) => {
          if (err) {
            console.error('Team logo upload error: ', err);
            res.status(500).json({ error: err.message });
          }
        });
      } catch (error) {
        console.error('Team logo upload route error: ', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.use(cors());
  app.use(morgan('dev', { skip: (req) => req.path === '/health' }));

  // Direct endpoint (unchanged)
  app.post('/api/upload', (req, res) => {
    parseFormData(req, res, (filePath) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
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
  app.use('/api/regions', regionRoutes(dbMain, ARGS.useMock));
  app.use('/api', generalRoutes(dbMain, ARGS.useMock));
  app.use('/api/auth', authRoutes(dbMain, ARGS.useMock));
  app.use('/auth', authRoutes(dbMain, ARGS.useMock)); // Add this line to also mount auth routes at /auth
  app.use('/api/system', systemRoutes(dbMain, ARGS.useMock));
  app.use('/api/clubs', clubsRoutes(dbMain, ARGS.useMock));
  app.use('/api/annual-reports', annualReportsRoutes(dbMain, ARGS.useMock));
  app.use('/api/teams', teamsRoutes(dbMain, ARGS.useMock));

  // New schemas
  app.use('/api/events', eventsRoutes(dbs, ARGS.useMock));
  app.use('/api/listings', listingsRoutes(dbs, ARGS.useMock));
  app.use('/api', usersRoutes(dbMain, ARGS.useMock)); // Mounts /api/users and /api/roles

  // Internal/test-only endpoints (dev/test environments only)
  if (process.env.NODE_ENV !== 'production') {
    const internalRoutes = require('./routes/internal').default;
    app.use('/api/internal', internalRoutes(dbMain, ARGS.useMock, true));
  }

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.get('*', (req, res) => {
    res.status(404).send('Resourse not found!');
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  const { port } = ARGS;
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on('error', (err) => {
    console.error(`Server failed to start: ${err.message}`);
    process.exit(1);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal) => {
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
};

function parseFormData(req, res, callback) {
  const boundary = req.headers['content-type'].split('boundary=')[1];
  let data = '';
  req.on('data', (chunk) => (data += chunk.toString()));
  req.on('end', () => {
    const parts = data.split('--' + boundary);
    parts.forEach((part) => {
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
