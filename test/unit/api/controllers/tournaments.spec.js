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

test('createFixtures accepts raw TSV uploads', async () => {
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

  let capturedTsvEncoded = null;
  let capturedRows = null;

  require.cache[servicePath] = {
    exports: {
      __esModule: true,
      default: () => ({
        validateTsv: (tsvEncoded) => {
          capturedTsvEncoded = tsvEncoded;
          return {
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
          };
        },
        createFixtures: async (...args) => {
          capturedRows = args[1];
          return { imported: true };
        },
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

  const tsv = `TIME\tMATCH\tCATEGORY\tPITCH\tTEAM1\tSTAGE\tTEAM2\tUMPIRES\tDuration
11:30\tA.07\tDivision1\tPitch_1\tNantes\tGp.3\tChouettes Gallèses\tRennes\t20`;

  const req = {
    params: { tournamentId: '77' },
    body: Buffer.from(tsv, 'utf8'),
  };
  const res = createMockRes();

  try {
    await controller.createFixtures(req, res, (err) => {
      if (err) throw err;
    });
  } finally {
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
  }

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.data, { data: { imported: true } });
  assert.equal(Buffer.from(capturedTsvEncoded, 'base64').toString('utf8'), tsv);
  assert.deepEqual(capturedRows, [
    {
      TIME: '11:30',
      MATCH: 'A.7',
      CATEGORY: 'DIVISION1',
      PITCH: 'PITCH_1',
      TEAM1: 'NANTES',
      STAGE: 'GP.3',
      TEAM2: 'CHOUETTES GALLÈSES',
      UMPIRES: 'RENNES',
      DURATION: 20,
    },
  ]);
});
