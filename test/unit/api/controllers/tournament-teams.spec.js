const test = require('node:test');
const assert = require('node:assert/strict');
const controllerFactory = require('../../../../src/api/controllers/tournament-teams');

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

const controller = controllerFactory({}, true);

test('listTeams returns rows', async () => {
  const req = { params: { tournamentId: '1' } };
  const res = createMockRes();

  await controller.listTeams(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length >= 1);
});

test('getTeamById returns row', async () => {
  const req = { params: { tournamentId: '1', id: '1' } };
  const res = createMockRes();

  await controller.getTeamById(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.id, 1);
});

test('createTeam validates entrantId', async () => {
  const req = {
    params: { tournamentId: '1' },
    body: { teamName: 'No entrant team' },
  };
  const res = createMockRes();

  await controller.createTeam(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'entrantId is required' });
});

test('createTeam creates row', async () => {
  const req = {
    params: { tournamentId: '1' },
    body: {
      entrantId: 7,
      teamName: 'Brussels A',
      teamType: 'primary',
    },
  };
  const res = createMockRes();

  await controller.createTeam(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.teamName, 'Brussels A');
});

test('updateTeam updates row', async () => {
  const req = {
    params: { tournamentId: '1', id: '1' },
    body: { teamName: 'Amsterdam Updated' },
  };
  const res = createMockRes();

  await controller.updateTeam(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.teamName, 'Amsterdam Updated');
});

test('createSquad creates placeholder players', async () => {
  const req = {
    params: { tournamentId: '1', id: '1' },
    body: { squadSize: 3 },
  };
  const res = createMockRes();

  await controller.createSquad(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.squadSizeRequested, 3);
  assert.equal(res.data.data.players.length, 3);
});

test('assignPlayer moves player to another team', async () => {
  // First ensure destination team has a squad too
  await controller.createSquad(
    { params: { tournamentId: '1', id: '2' }, body: { squadSize: 1 } },
    createMockRes(),
    mockNext
  );

  const sourceSquadRes = createMockRes();
  await controller.createSquad(
    { params: { tournamentId: '1', id: '1' }, body: { squadSize: 3 } },
    sourceSquadRes,
    mockNext
  );

  const playerId = sourceSquadRes.data.data.players[0].id;

  const req = {
    params: { tournamentId: '1', id: '1', playerId: String(playerId) },
    body: { toTeamId: 2 },
  };
  const res = createMockRes();

  await controller.assignPlayer(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.playerId, playerId);
  assert.equal(res.data.data.toTeamId, 2);
});

test('deleteTeam deletes row', async () => {
  const created = createMockRes();
  await controller.createTeam(
    {
      params: { tournamentId: '1' },
      body: { entrantId: 8, teamName: 'Delete me' },
    },
    created,
    mockNext
  );

  const teamId = created.data.data.id;
  const req = { params: { tournamentId: '1', id: String(teamId) } };
  const res = createMockRes();

  await controller.deleteTeam(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.id, teamId);
});
