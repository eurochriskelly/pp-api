const test = require('node:test');
const assert = require('node:assert/strict');
const championshipsControllerFactory = require('../../../../src/api/controllers/championships');

function createMockRes() {
  const res = {
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
  return res;
}

const mockNext = (err) => {
  throw err;
};

const controller = championshipsControllerFactory({}, true);

test('listChampionships returns rows', async () => {
  const req = { query: {} };
  const res = createMockRes();

  await controller.listChampionships(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length >= 1);
});

test('getChampionshipById returns row', async () => {
  const req = { params: { championshipId: '1' } };
  const res = createMockRes();

  await controller.getChampionshipById(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.id, 1);
});

test('getChampionshipById validates id', async () => {
  const req = { params: { championshipId: 'abc' } };
  const res = createMockRes();

  await controller.getChampionshipById(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid championship ID' });
});

test('createChampionship validates required fields', async () => {
  const req = { body: { name: 'Missing series/year' } };
  const res = createMockRes();

  await controller.createChampionship(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, {
    error: 'seriesId, name and year are required',
  });
});

test('createChampionship creates row', async () => {
  const req = {
    body: {
      seriesId: 1,
      name: 'Senior Football 2027',
      year: 2027,
      numRounds: 5,
    },
  };
  const res = createMockRes();

  await controller.createChampionship(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.name, 'Senior Football 2027');
});

test('listEntrants returns rows', async () => {
  const req = { params: { championshipId: '1' } };
  const res = createMockRes();

  await controller.listEntrants(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length >= 1);
});

test('createEntrant validates fields', async () => {
  const req = {
    params: { championshipId: '1' },
    body: { entrantType: 'club' },
  };
  const res = createMockRes();

  await controller.createEntrant(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, {
    error: 'entrantType and displayName are required',
  });
});

test('createEntrant creates entrant', async () => {
  const req = {
    params: { championshipId: '1' },
    body: {
      entrantType: 'club',
      displayName: 'Brussels Harps',
      clubId: 202,
    },
  };
  const res = createMockRes();

  await controller.createEntrant(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.displayName, 'Brussels Harps');
});

test('listRounds returns round summaries', async () => {
  const req = { params: { championshipId: '1' } };
  const res = createMockRes();

  await controller.listRounds(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.equal(res.data.data[0].roundNumber, 1);
});

test('getStandings returns standings rows', async () => {
  const req = { params: { championshipId: '1' } };
  const res = createMockRes();

  await controller.getStandings(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length >= 1);
  assert.equal(typeof res.data.data[0].points, 'number');
});

test('getEntrantById returns entrant', async () => {
  const req = { params: { championshipId: '1', entrantId: '1' } };
  const res = createMockRes();

  await controller.getEntrantById(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.id, 1);
});

test('getEntrantById validates ids', async () => {
  const req = { params: { championshipId: 'x', entrantId: '1' } };
  const res = createMockRes();

  await controller.getEntrantById(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, {
    error: 'Invalid championship ID or entrant ID',
  });
});

test('updateEntrant updates entrant', async () => {
  const req = {
    params: { championshipId: '1', entrantId: '1' },
    body: { displayName: 'Amsterdam GAC Updated', status: 'active' },
  };
  const res = createMockRes();

  await controller.updateEntrant(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.displayName, 'Amsterdam GAC Updated');
  assert.equal(res.data.data.status, 'active');
});

test('deleteEntrant marks entrant withdrawn', async () => {
  const req = { params: { championshipId: '1', entrantId: '1' } };
  const res = createMockRes();

  await controller.deleteEntrant(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.message, 'Entrant withdrawn');
});

test('addAmalgamationClub validates ids', async () => {
  const req = {
    params: { championshipId: '1', entrantId: '2' },
    body: { clubId: 'x' },
  };
  const res = createMockRes();

  await controller.addAmalgamationClub(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, {
    error: 'Invalid championship ID, entrant ID or clubId',
  });
});

test('addAmalgamationClub links club for amalgamation entrant', async () => {
  const req = {
    params: { championshipId: '1', entrantId: '2' },
    body: { clubId: 303 },
  };
  const res = createMockRes();

  await controller.addAmalgamationClub(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.entrantId, 2);
  assert.equal(res.data.data.clubId, 303);
});
