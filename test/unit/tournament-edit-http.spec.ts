import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import tournamentController from '../../src/api/controllers/tournaments';
import usersRoutes from '../../src/api/routes/users';

test('tournament edit round-trips every submitted field and validates dates', async () => {
  const app = express();
  app.use(express.json());
  const ctrl = tournamentController(null, true);
  app.post('/tournaments', ctrl.createTournament);
  app.put('/tournaments/:tournamentId', ctrl.updateTournament);
  app.get('/tournaments/:tournamentId', ctrl.getTournament);
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${(server.address() as any).port}/tournaments`;
    const created = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '1',
        title: 'Test',
        date: '2026-10-08',
        location: 'Heaven',
      }),
    });
    const { id } = (await created.json()) as any;
    const changes = {
      title: 'Updated',
      date: '2026-10-09',
      endDate: '2026-10-10',
      lat: 0,
      lon: 1,
      codeOrganizer: '1111',
      codeCoordinator: 'KKDI',
      codeReferee: '9EFC',
      codeTeam: 'UT28',
      competitionSettings: [
        {
          category: 'CAMOGIE',
          winPoints: 5,
          drawPoints: 2,
          losePoints: 1,
          verifyGroupStages: true,
        },
        {
          category: 'HURLING',
          winPoints: 2,
          drawPoints: 1,
          losePoints: 0,
          verifyGroupStages: false,
        },
      ],
    };
    const response = await fetch(`${url}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    assert.equal(response.status, 200);
    const { data } = (await (await fetch(`${url}/${id}`)).json()) as any;
    for (const [key, value] of Object.entries(changes))
      assert.deepEqual(data[key], value, key);
    const invalid = await fetch(`${url}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate: '2026-10-01' }),
    });
    assert.equal(invalid.status, 400);
  } finally {
    server.close();
  }
});

test('authenticated non-admin can search organizer names but cannot list all users', async () => {
  const saved = {
    bypass: process.env.PP_BYPASS_AUTH,
    email: process.env.PP_EMAIL,
    role: process.env.PP_BYPASS_ROLE,
    insecure: process.env.PP_INSECURE_EVENT_MODE,
  };
  process.env.PP_BYPASS_AUTH = '1';
  process.env.PP_EMAIL = 'test@example.invalid';
  process.env.PP_BYPASS_ROLE = 'player';
  delete process.env.PP_INSECURE_EVENT_MODE;
  const app = express();
  app.use(usersRoutes({}, true));
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${(server.address() as any).port}/users`;
    const headers = { Authorization: 'Bearer dev-bypass-token' };
    assert.equal((await fetch(`${url}?filter=joh`, { headers })).status, 200);
    assert.equal((await fetch(url, { headers })).status, 403);
    assert.equal((await fetch(`${url}?filter=j`, { headers })).status, 403);
    assert.equal((await fetch(`${url}?filter=joh`)).status, 401);
  } finally {
    server.close();
    for (const [key, value] of Object.entries({
      PP_BYPASS_AUTH: saved.bypass,
      PP_EMAIL: saved.email,
      PP_BYPASS_ROLE: saved.role,
      PP_INSECURE_EVENT_MODE: saved.insecure,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
