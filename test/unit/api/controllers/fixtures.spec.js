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

test('updateScore accepts structured team score payloads', async () => {
  const servicePath = require.resolve('../../../../src/api/services/fixtures');
  const controllerPath = require.resolve(
    '../../../../src/api/controllers/fixtures'
  );
  const originalServiceModule = require.cache[servicePath];
  const originalControllerModule = require.cache[controllerPath];

  let capturedArgs = null;

  require.cache[servicePath] = {
    exports: {
      __esModule: true,
      default: () => ({
        updateScore: async (...args) => {
          capturedArgs = args;
          return { updated: true };
        },
      }),
    },
  };
  delete require.cache[controllerPath];

  const controllerModule = require('../../../../src/api/controllers/fixtures');
  const fixturesControllerFactory =
    controllerModule.default || controllerModule;
  const controller = fixturesControllerFactory({}, false);

  const req = {
    params: { tournamentId: '38', fixtureId: '380001' },
    body: {
      outcome: 'played',
      scores: {
        team1: { name: 'A', goals: 7, points: 8 },
        team2: { name: 'B', goals: 5, points: 4 },
      },
    },
  };
  const res = createMockRes();

  try {
    await controller.updateScore(req, res);
  } finally {
    if (originalServiceModule) {
      require.cache[servicePath] = originalServiceModule;
    } else {
      delete require.cache[servicePath];
    }

    if (originalControllerModule) {
      require.cache[controllerPath] = originalControllerModule;
    } else {
      delete require.cache[controllerPath];
    }
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data, { message: 'Score updated successfully' });
  assert.deepEqual(capturedArgs, [
    '38',
    '380001',
    { name: 'A', goals: 7, points: 8 },
    { name: 'B', goals: 5, points: 4 },
    'played',
  ]);
});

test('updateScore rejects malformed score payloads', async () => {
  const controllerModule = require('../../../../src/api/controllers/fixtures');
  const fixturesControllerFactory =
    controllerModule.default || controllerModule;
  const controller = fixturesControllerFactory({}, true);

  const req = {
    params: { tournamentId: '38', fixtureId: '380001' },
    body: {
      outcome: 'played',
      scores: {
        team1: 7,
        team2: 5,
      },
    },
  };
  const res = createMockRes();

  await controller.updateScore(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'INVALID_REQUEST');
});

test('reschedule rejects missing placement', async () => {
  const controllerModule = require('../../../../src/api/controllers/fixtures');
  const fixturesControllerFactory =
    controllerModule.default || controllerModule;
  const controller = fixturesControllerFactory({}, true);

  const req = {
    params: { tournamentId: '50', fixtureId: '500019' },
    body: {
      targetFixture: 500001,
    },
  };
  const res = createMockRes();

  await controller.reschedule(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'INVALID_REQUEST');
});

test('reschedule maps targetFixture to relativeFixtureId', async () => {
  const servicePath = require.resolve('../../../../src/api/services/fixtures');
  const controllerPath = require.resolve(
    '../../../../src/api/controllers/fixtures'
  );
  const originalServiceModule = require.cache[servicePath];
  const originalControllerModule = require.cache[controllerPath];

  let capturedArgs = null;

  require.cache[servicePath] = {
    exports: {
      __esModule: true,
      default: () => ({
        reschedule: async (...args) => {
          capturedArgs = args;
          return {
            fixtureId: 500019,
            action: 'move',
            newScheduled: '2024-01-01 10:00:00',
            pitch: 'PITCH1',
          };
        },
      }),
    },
  };
  delete require.cache[controllerPath];

  const controllerModule = require('../../../../src/api/controllers/fixtures');
  const fixturesControllerFactory =
    controllerModule.default || controllerModule;
  const controller = fixturesControllerFactory({}, false);

  const req = {
    params: { tournamentId: '50', fixtureId: '500019' },
    body: {
      placement: 'after',
      targetFixture: 500001,
      targetPitch: 'PITCH1',
    },
  };
  const res = createMockRes();

  try {
    await controller.reschedule(req, res);
  } finally {
    if (originalServiceModule) {
      require.cache[servicePath] = originalServiceModule;
    } else {
      delete require.cache[servicePath];
    }

    if (originalControllerModule) {
      require.cache[controllerPath] = originalControllerModule;
    } else {
      delete require.cache[controllerPath];
    }
  }

  assert.equal(res.statusCode, 200);
  assert.equal(capturedArgs[0].fixtureId, 500019);
  assert.equal(capturedArgs[0].relativeFixtureId, 500001);
  assert.equal(capturedArgs[0].action, 'move');
});

test('reschedule rejects swap placement', async () => {
  const controllerModule = require('../../../../src/api/controllers/fixtures');
  const fixturesControllerFactory =
    controllerModule.default || controllerModule;
  const controller = fixturesControllerFactory({}, true);

  const req = {
    params: { tournamentId: '50', fixtureId: '500006' },
    body: {
      placement: 'swap',
      targetFixture: 500002,
    },
  };
  const res = createMockRes();

  await controller.reschedule(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'INVALID_REQUEST');
});
