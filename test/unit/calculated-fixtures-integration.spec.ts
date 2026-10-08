import calculatedFactory from '../../src/api/services/fixtures/calculated-fixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fixturesFactory from '../../src/api/services/fixtures';
import tournamentFactory from '../../src/api/services/tournaments';
import calculatedController from '../../src/api/controllers/calculated-fixtures';

function database() {
  let tournament: any = {
    id: 68,
    pointsForWin: 2,
    pointsForDraw: 1,
    pointsForLoss: 0,
    verifyGroupStages: false,
  };
  let fixtures: any[] = [
    {
      id: 1,
      tournamentId: 68,
      category: 'CAMOGIE',
      stage: 'group',
      groupNumber: 1,
      team1Id: 'A',
      team2Id: 'B',
      goals1: 0,
      points1: 5,
      goals2: 0,
      points2: 1,
      outcome: 'in-progress',
    },
    {
      id: 2,
      tournamentId: 68,
      category: 'CAMOGIE',
      stage: 'cup_finals',
      outcome: 'not played',
      team1Planned: '~group:1/p:1',
      team2Planned: '~group:1/p:2',
      umpireTeamPlanned: '~match:1/p:1',
    },
    {
      id: 3,
      tournamentId: 68,
      category: 'HURLING',
      stage: 'cup_finals',
      outcome: 'not played',
      team1Planned: '~group:1/p:1',
      team1Id: 'KEEP',
    },
  ];
  let snapshot: any;
  const statements: string[] = [];
  const db = {
    query: (sql: string, params: any[], callback: any) => {
      statements.push(sql);
      try {
        let result: any = [];
        if (sql === 'START TRANSACTION')
          snapshot = JSON.parse(JSON.stringify({ tournament, fixtures }));
        else if (sql === 'ROLLBACK') {
          tournament = snapshot.tournament;
          fixtures = snapshot.fixtures;
        } else if (sql === 'COMMIT') {
          /* committed */
        } else if (sql.includes('SELECT') && sql.includes('FROM tournaments'))
          result = [{ ...tournament }];
        else if (sql.includes('SELECT') && sql.includes('FROM fixtures')) {
          if (sql.includes('WHERE id = ?'))
            result = fixtures.filter((f) => f.id === params[0]);
          else
            result = fixtures.filter(
              (f) =>
                f.tournamentId === params[0] &&
                (!params[1] || f.category === params[1])
            );
          result = result.map((f: any) => ({ ...f }));
        } else if (sql.includes('UPDATE tournaments')) {
          if (sql.includes('SET groupStageVerificationHashes = NULL')) {
            tournament.groupStageVerificationHashes = null;
          } else {
            const fields = [...sql.matchAll(/(\w+) = \?/g)]
              .map((match) => match[1])
              .filter((field) => field !== 'id');
            fields.forEach((field, index) => {
              tournament[field] = params[index];
            });
          }
          result = { affectedRows: 1 };
        } else if (sql.includes('UPDATE fixtures')) {
          if (sql.includes('SET updated = CURRENT_TIMESTAMP')) {
            fixtures
              .filter((f) => f.tournamentId === params[0])
              .forEach((f) => {
                f.updated = new Date().toISOString();
              });
          } else if (sql.includes('SET ended')) {
            const f = fixtures.find((row) => row.id === params[2]);
            f.ended = params[0];
            f.outcome = params[1];
          } else if (sql.includes('SET goals1')) {
            const f = fixtures.find((row) => row.id === params[11]);
            [
              'goals1',
              'points1',
              'goals1Extra',
              'points1Extra',
              'goals1Penalties',
              'goals2',
              'points2',
              'goals2Extra',
              'points2Extra',
              'goals2Penalties',
              'outcome',
            ].forEach((field, index) => {
              f[field] = params[index];
            });
          } else {
            const field = sql.match(/SET (\w+) =/)![1];
            fixtures.find((f) => f.id === params[1])[field] = params[0];
          }
          result = { affectedRows: 1 };
        } else throw new Error(`Unexpected SQL: ${sql}`);
        callback(null, result);
      } catch (error) {
        callback(error);
      }
    },
  };
  return {
    db,
    statements,
    fixture: (id: number) => fixtures.find((f) => f.id === id),
  };
}

test('ending the last group fixture automatically assigns teams and umpires in the same transaction', async () => {
  const store = database();
  await fixturesFactory(store.db).endFixture(1);
  assert.equal(store.fixture(2).team1Id, 'A');
  assert.equal(store.fixture(2).team2Id, 'B');
  assert.equal(store.fixture(2).umpireTeamId, 'A');
  assert.equal(store.fixture(2).team1Planned, '~group:1/p:1');
  assert.equal(store.fixture(3).team1Id, 'KEEP');
  assert.ok(store.statements.includes('COMMIT'));
});

test('score corrections refresh assignments; in-progress scores never supply a match winner', async () => {
  const store = database();
  const service = fixturesFactory(store.db);
  await service.updateScore(
    68,
    1,
    { goals: 0, points: 1 },
    { goals: 0, points: 6 },
    'in-progress'
  );
  assert.equal(store.fixture(2).umpireTeamId, 'PENDING');
  await service.updateScore(
    68,
    1,
    { goals: 0, points: 1 },
    { goals: 0, points: 6 },
    'played'
  );
  assert.equal(store.fixture(2).team1Id, 'B');
  assert.equal(store.fixture(2).umpireTeamId, 'B');
});

test('enabling and disabling tournament verification immediately refreshes completed group assignments', async () => {
  const store = database();
  await fixturesFactory(store.db).endFixture(1);
  await tournamentFactory(store.db).updateTournament(68, {
    verifyGroupStages: true,
  });
  assert.equal(store.fixture(2).team1Id, 'PENDING');
  await tournamentFactory(store.db).updateTournament(68, {
    verifyGroupStages: false,
  });
  assert.equal(store.fixture(2).team1Id, 'A');
  assert.equal(store.fixture(3).team1Id, 'CONTESTED');
});

test('refresh HTTP endpoint validates modes and applies category-scoped placeholders', async () => {
  const store = database();
  const app = express();
  app.use(express.json());
  app.post(
    '/api/tournaments/:tournamentId/calculated-fixtures/refresh',
    calculatedController(store.db, false).refresh
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as any;
  const url = `http://127.0.0.1:${address.port}/api/tournaments/68/calculated-fixtures/refresh`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'CAMOGIE', mode: 'contested' }),
    });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as any;
    assert.equal(payload.data.changes.length, 3);
    assert.equal(store.fixture(2).umpireTeamId, 'CONTESTED');
    assert.equal(store.fixture(3).team1Id, 'KEEP');
    const invalid = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'bogus' }),
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('unchanged settings and changes in another category preserve approved groups', async () => {
  const store = database();
  const service = tournamentFactory(store.db);
  const settings = [
    {
      category: 'CAMOGIE',
      winPoints: 2,
      drawPoints: 1,
      losePoints: 0,
      verifyGroupStages: true,
    },
    {
      category: 'HURLING',
      winPoints: 2,
      drawPoints: 1,
      losePoints: 0,
      verifyGroupStages: false,
    },
  ];
  await fixturesFactory(store.db).endFixture(1);
  await service.updateTournament(68, { competitionSettings: settings });
  await calculatedFactory(store.db).refresh(68, {
    category: 'CAMOGIE',
    approveGroups: true,
  });
  assert.equal(store.fixture(2).team1Id, 'A');
  await service.updateTournament(68, {
    competitionSettings: settings.map((setting) => ({ ...setting })),
  });
  assert.equal(store.fixture(2).team1Id, 'A');
  await service.updateTournament(68, {
    competitionSettings: settings.map((setting) =>
      setting.category === 'HURLING' ? { ...setting, winPoints: 5 } : setting
    ),
  });
  assert.equal(store.fixture(2).team1Id, 'A');
});
