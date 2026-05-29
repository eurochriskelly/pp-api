const test = require('node:test');
const assert = require('node:assert/strict');

function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
}

function setupControllerMocks(overrides) {
  const servicePath = require.resolve(
    '../../../../src/api/services/tournaments'
  );
  const mockServicePath = require.resolve(
    '../../../../src/api/services/mocks/tournaments'
  );
  const reportCachePath = require.resolve(
    '../../../../src/api/services/tournaments/report-cache'
  );
  const controllerPath = require.resolve(
    '../../../../src/api/controllers/tournaments'
  );

  const originalServiceModule = require.cache[servicePath];
  const originalMockServiceModule = require.cache[mockServicePath];
  const originalReportCacheModule = require.cache[reportCachePath];
  const originalControllerModule = require.cache[controllerPath];

  require.cache[servicePath] = {
    exports: {
      __esModule: true,
      default: () => ({
        validateTsv: () => ({
          rows: [
            {
              TIME: { value: '11:30' },
              MATCH: { value: 'A.7' },
              CATEGORY: { value: 'DIVISION1' },
              PITCH: { value: 'PITCH_1' },
              TEAM1: { value: 'NANTES' },
              STAGE: { value: 'GP.3' },
              TEAM2: { value: 'CHOUETTES GALLÈSES' },
              UMPIRES: { value: 'RENNES' },
              DURATION: { value: 20 },
            },
          ],
          warnings: [],
          stages: {},
        }),
        ...overrides,
      }),
    },
  };
  require.cache[mockServicePath] = {
    exports: {
      __esModule: true,
      default: () => ({}),
    },
  };
  require.cache[reportCachePath] = {
    exports: {
      __esModule: true,
      createTournamentReportCache: () => ({
        start() {},
      }),
    },
  };
  delete require.cache[controllerPath];

  const controllerModule = require('../../../../src/api/controllers/tournaments');
  const tournamentsControllerFactory =
    controllerModule.default || controllerModule;
  const controller = tournamentsControllerFactory({}, false);

  return {
    controller,
    restore: () => {
      if (originalServiceModule) {
        require.cache[servicePath] = originalServiceModule;
      } else {
        delete require.cache[servicePath];
      }

      if (originalMockServiceModule) {
        require.cache[mockServicePath] = originalMockServiceModule;
      } else {
        delete require.cache[mockServicePath];
      }

      if (originalReportCacheModule) {
        require.cache[reportCachePath] = originalReportCacheModule;
      } else {
        delete require.cache[reportCachePath];
      }

      if (originalControllerModule) {
        require.cache[controllerPath] = originalControllerModule;
      } else {
        delete require.cache[controllerPath];
      }
    },
  };
}

test('createFixturesWithTournament creates tournament from TSV metadata', async () => {
  let createdTournamentArgs = null;
  let createdFixturesArgs = null;

  const { controller, restore } = setupControllerMocks({
    findTournamentByUniqueFields: async () => null,
    createTournament: async (...args) => {
      createdTournamentArgs = args;
      return {
        id: 99,
        Title: 'BREAGH FOOTBALL R.3',
        eventUuid: 'test-uuid',
      };
    },
    createFixtures: async (...args) => {
      createdFixturesArgs = args;
      return { imported: true };
    },
  });

  const tsv = `% REGION: Benelux
% TITLE: BREAGH FOOTBALL R.3
% LOCATION: LUXEMBOURG
% DATE: 2026-06-01
% LAT-LON: 53.3498,-6.2603
% CODE-ORG-COORD: NHL2,HA22
% WIN-DRAW-LOSS: 2,1,0
TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDuration
11:30\tA.07\tDivision1\tPitch_1\tNantes\tGp.3\tChouettes Gallèses\tRennes\t20`;

  const req = {
    user: { id: 42 },
    body: Buffer.from(tsv, 'utf8'),
  };
  const res = createMockRes();

  try {
    await controller.createFixturesWithTournament(req, res, (err) => {
      if (err) throw err;
    });
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.tournament.id, 99);
  assert.equal(createdTournamentArgs[0], 42);
  assert.equal(createdTournamentArgs[1].region, 'Benelux');
  assert.equal(createdTournamentArgs[1].title, 'BREAGH FOOTBALL R.3');
  assert.equal(createdTournamentArgs[1].location, 'LUXEMBOURG');
  assert.equal(createdTournamentArgs[1].date, '2026-06-01');
  assert.equal(createdTournamentArgs[1].lat, 53.3498);
  assert.equal(createdTournamentArgs[1].lon, -6.2603);
  assert.equal(createdTournamentArgs[1].codeOrganizer, 'NHL2');
  assert.equal(createdTournamentArgs[1].codeCoordinator, 'HA22');
  assert.equal(createdTournamentArgs[1].winPoints, 2);
  assert.equal(createdTournamentArgs[1].drawPoints, 1);
  assert.equal(createdTournamentArgs[1].lossPoints, 0);
  assert.equal(createdFixturesArgs[0], 99);
});

test('createFixturesWithTournament updates existing tournament', async () => {
  let updatedTournamentArgs = null;
  let createdFixturesArgs = null;

  const { controller, restore } = setupControllerMocks({
    findTournamentByUniqueFields: async () => ({
      id: 77,
      Title: 'BREAGH FOOTBALL R.3',
      eventUuid: 'existing-uuid',
    }),
    updateTournament: async (...args) => {
      updatedTournamentArgs = args;
      return {};
    },
    getTournament: async () => ({
      id: 77,
      Title: 'BREAGH FOOTBALL R.3',
      eventUuid: 'existing-uuid',
    }),
    createFixtures: async (...args) => {
      createdFixturesArgs = args;
      return { imported: true };
    },
  });

  const tsv = `% REGION: Benelux
% TITLE: BREAGH FOOTBALL R.3
% LOCATION: LUXEMBOURG
% DATE: 2026-06-01
% LAT-LON: 53.3498,-6.2603
% CODE-ORG-COORD: NHL2,HA22
% WIN-DRAW-LOSS: 2,1,0
TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDuration
11:30\tA.07\tDivision1\tPitch_1\tNantes\tGp.3\tChouettes Gallèses\tRennes\t20`;

  const req = {
    user: { id: 42 },
    body: Buffer.from(tsv, 'utf8'),
  };
  const res = createMockRes();

  try {
    await controller.createFixturesWithTournament(req, res, (err) => {
      if (err) throw err;
    });
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.tournament.id, 77);
  assert.equal(updatedTournamentArgs[0], 77);
  assert.equal(updatedTournamentArgs[1].codeCoordinator, 'HA22');
  assert.equal(createdFixturesArgs[0], 77);
});

test('createFixturesWithTournament falls back to userId 1 when no auth', async () => {
  let createdTournamentArgs = null;

  const { controller, restore } = setupControllerMocks({
    findTournamentByUniqueFields: async () => null,
    createTournament: async (...args) => {
      createdTournamentArgs = args;
      return {
        id: 100,
        Title: 'BREAGH FOOTBALL R.3',
        eventUuid: 'test-uuid',
      };
    },
    createFixtures: async () => ({ imported: true }),
  });

  const tsv = `% REGION: Benelux
% TITLE: BREAGH FOOTBALL R.3
% LOCATION: LUXEMBOURG
% DATE: 2026-06-01
TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDuration
11:30\tA.07\tDivision1\tPitch_1\tNantes\tGp.3\tChouettes Gallèses\tRennes\t20`;

  const req = {
    user: undefined,
    body: Buffer.from(tsv, 'utf8'),
  };
  const res = createMockRes();

  try {
    await controller.createFixturesWithTournament(req, res, (err) => {
      if (err) throw err;
    });
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 201);
  assert.equal(createdTournamentArgs[0], 1);
});

test('createFixturesWithTournament returns 400 when metadata is missing', async () => {
  const { controller, restore } = setupControllerMocks({});

  const tsv = `TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDuration
11:30\tA.07\tDivision1\tPitch_1\tNantes\tGp.3\tChouettes Gallèses\tRennes\t20`;

  const req = {
    user: { id: 42 },
    body: Buffer.from(tsv, 'utf8'),
  };
  const res = createMockRes();

  try {
    await controller.createFixturesWithTournament(req, res, (err) => {
      if (err) throw err;
    });
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'MISSING_TOURNAMENT_METADATA');
});
