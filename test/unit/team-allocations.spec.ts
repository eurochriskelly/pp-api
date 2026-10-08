import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import routes from '../../src/api/routes/tournaments/team-allocations';
import {
  buildTeam,
  validateAllocations,
  validateSuffix,
} from '../../src/api/services/team-allocations/model';

const entrants = ['Dublin', 'Wexford', 'Wicklow'].map((displayName, index) => ({
  id: index + 1,
  championshipId: 1,
  displayName,
  entrantType: index === 2 ? 'amalgamation' : 'club',
  status: 'active',
}));

test('mixed team name, lead, and proportions are derived from player counts', () => {
  const team = buildTeam(
    { id: 8, teamName: 'Original fixture label', teamSuffix: 'B' },
    entrants,
    [
      { entrantId: 3, numPlayers: 2 },
      { entrantId: 1, numPlayers: 8 },
      { entrantId: 2, numPlayers: 5 },
    ],
    true
  );
  assert.equal(team.displayName, 'Dublin / Wexford / Wicklow B');
  assert.equal(team.fixtureName, 'Original fixture label');
  assert.equal(team.leadingEntrantId, 1);
  assert.equal(team.totalPlayers, 15);
  assert.deepEqual(
    team.allocations.map((row) => row.proportion),
    [8 / 15, 5 / 15, 2 / 15]
  );
  assert.equal(team.allocations[2].entrantType, 'amalgamation');
  assert.equal(team.needsAllocation, false);
});

test('ties have one stable leader regardless of incoming order', () => {
  const team = buildTeam(
    { id: 1, teamName: 'Mixed' },
    entrants,
    [
      { entrantId: 2, numPlayers: 5 },
      { entrantId: 1, numPlayers: 5 },
    ],
    true
  );
  assert.equal(team.leadingEntrantId, 1);
  assert.equal(team.displayName, 'Dublin / Wexford');
});

test('unlinked, incomplete, or withdrawn allocations require attention', () => {
  for (const [roster, rows, hasRound] of [
    [entrants, [], true],
    [entrants, [{ entrantId: 1, numPlayers: null }], true],
    [entrants, [{ entrantId: 1, numPlayers: 8 }], false],
    [entrants, [{ entrantId: 999, numPlayers: 8 }], true],
    [
      entrants.map((row) => ({ ...row, status: 'withdrawn' })),
      [{ entrantId: 1, numPlayers: 8 }],
      true,
    ],
  ] as any[]) {
    const team = buildTeam(
      { id: 1, teamName: 'Schedule label' },
      roster,
      rows,
      hasRound
    );
    assert.equal(team.needsAllocation, true);
    assert.equal(team.totalPlayers, null);
    assert.equal(team.displayName, 'Schedule label');
  }
});

test('allocation input rejects invalid counts, duplicates, and overflow', () => {
  for (const value of [
    null,
    {},
    [{ entrantId: 1, numPlayers: 0 }],
    [{ entrantId: 1, numPlayers: -1 }],
    [{ entrantId: 1, numPlayers: 1.5 }],
    [{ entrantId: '1', numPlayers: 8 }],
    [{ entrantId: 1, numPlayers: '8' }],
    [
      { entrantId: 1, numPlayers: 8 },
      { entrantId: 1, numPlayers: 5 },
    ],
    [
      { entrantId: 1, numPlayers: 2147483647 },
      { entrantId: 2, numPlayers: 1 },
    ],
  ]) {
    assert.throws(() => validateAllocations(value));
  }
  assert.deepEqual(validateAllocations([]), []);
  assert.equal(validateSuffix('b'), 'B');
  assert.throws(() => validateSuffix('A / B'));
});

test('HTTP allocations are public to read and require organizer authority to persist', async () => {
  const app = express();
  app.use(express.json());
  app.use('/tournaments/:tournamentId/team-allocations', routes({}, true));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/tournaments/1001/team-allocations`;
  const put = (body: any, code?: string, target = '/teams/2') =>
    fetch(`${base}${target}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(code ? { 'X-Tournament-Organizer-Code': code } : {}),
      },
      body: JSON.stringify(body),
    });
  const post = (body: any, code?: string) =>
    fetch(`${base}/championships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(code ? { 'X-Tournament-Organizer-Code': code } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    const read = await fetch(base);
    assert.equal(read.status, 200);
    assert.deepEqual(
      ((await read.json()) as any).data.competitions[0].teams[0].fixtures,
      []
    );
    assert.equal(
      (
        await post({
          name: 'New Hurling Championship',
          seriesName: 'New Hurling Series',
          year: 2026,
          numRounds: 4,
        })
      ).status,
      401
    );
    const created = await post(
      {
        name: 'New Hurling Championship',
        seriesName: 'New Hurling Series',
        year: 2026,
        numRounds: 4,
      },
      'ORG1'
    );
    assert.equal(created.status, 200);
    assert.equal(
      ((await created.json()) as any).data.name,
      'New Hurling Championship'
    );
    const body = {
      suffix: 'B',
      allocations: [
        { entrantId: 1, numPlayers: 8 },
        { entrantId: 2, numPlayers: 5 },
      ],
    };
    assert.equal((await put(body)).status, 401);
    assert.equal((await put(body, 'COO1')).status, 403);
    assert.equal((await put(body, 'WRNG')).status, 403);
    assert.equal((await put(body, 'ORG1', '/teams/999')).status, 404);
    assert.equal(
      (await put({ allocations: [{ entrantId: 999, numPlayers: 8 }] }, 'ORG1'))
        .status,
      400
    );
    assert.equal(
      (await put({ allocations: [{ entrantId: 1, numPlayers: 1.5 }] }, 'ORG1'))
        .status,
      400
    );
    const saved = await put(body, 'org1');
    assert.equal(saved.status, 200);
    const { data } = (await saved.json()) as any;
    assert.equal(data.competitions[0].teams[1].totalPlayers, 13);
    assert.equal(data.competitions[0].teams[1].leadingEntrantId, 1);
    assert.equal(
      (
        await put(
          { championshipId: 2, roundNumber: 1 },
          'ORG1',
          '/competitions/1/round'
        )
      ).status,
      409
    );
    const reread = (await (await fetch(base)).json()) as any;
    assert.equal(reread.data.competitions[0].teams[1].totalPlayers, 13);
    assert.equal((await put({ allocations: [] }, 'ORG1')).status, 200);
    assert.equal(
      (
        await put(
          { championshipId: 1, roundNumber: 9 },
          'ORG1',
          '/competitions/1/round'
        )
      ).status,
      400
    );
    assert.equal(
      (
        await put(
          { championshipId: 2, roundNumber: 1 },
          'ORG1',
          '/competitions/1/round'
        )
      ).status,
      200
    );
    assert.equal(
      (
        await put(
          { championshipId: 1, roundNumber: 1 },
          'ORG1',
          '/competitions/1/round'
        )
      ).status,
      200
    );
  } finally {
    server.close();
  }
});
