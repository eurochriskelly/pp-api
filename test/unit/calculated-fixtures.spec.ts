import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalculatedResolver } from '../../src/api/services/fixtures/calculated-fixtures/resolver';
import { refreshCalculatedFixtures } from '../../src/api/services/fixtures/calculated-fixtures';

const points = { win: 2, draw: 1, loss: 0 };
const game = (
  id: number,
  a: string,
  b: string,
  x: number,
  y: number,
  groupNumber = 1
): any => ({
  id,
  tournamentId: 68,
  category: 'CAMOGIE',
  stage: 'group',
  groupNumber,
  team1Id: a,
  team2Id: b,
  goals1: 0,
  goals2: 0,
  points1: x,
  points2: y,
  outcome: x == null ? 'not played' : 'played',
});
const knockout = (): any => ({
  id: 15,
  tournamentId: 68,
  category: 'CAMOGIE',
  stage: 'cup_semis',
  outcome: 'not played',
  team1Planned: '~group:1/p:1',
  team2Planned: '~group:1/p:2',
  umpireTeamPlanned: '~group:1/p:3',
  team1Id: null,
  team2Id: null,
  umpireTeamId: null,
});
const games = () => [
  game(1, 'A', 'B', 10, 5),
  game(2, 'A', 'C', 9, 3),
  game(3, 'B', 'C', 8, 2),
];

function store(fixtures = [...games(), knockout()], verifyGroupStages = false) {
  const tournament: any = {
    id: 68,
    pointsForWin: 2,
    pointsForDraw: 1,
    pointsForLoss: 0,
    verifyGroupStages,
  };
  const ops = {
    select: async (sql: string, params: any[]) =>
      sql.includes('FROM tournaments')
        ? [tournament]
        : fixtures
            .filter((f) => !params[1] || f.category === params[1])
            .map((f) => ({ ...f })),
    update: async (sql: string, params: any[]) => {
      if (sql.includes('UPDATE tournaments'))
        tournament.groupStageVerificationHashes = params[0];
      else {
        assert.ok(
          !/SET .*Planned/.test(sql),
          'planned references must never be changed'
        );
        const field = sql.match(/SET (\w+) =/)![1];
        fixtures.find((f) => f.id === params[1])[field] = params[0];
      }
      return 1;
    },
  };
  return { fixtures, tournament, ops };
}

test('last group result resolves every team and umpire field and preserves all planned references', async () => {
  const { ops, fixtures } = store();
  const original = { ...fixtures[3] };
  const result = await refreshCalculatedFixtures(ops, 68);
  assert.equal(result.changes.length, 3);
  assert.equal(fixtures[3].team1Id, 'A');
  assert.equal(fixtures[3].team2Id, 'B');
  assert.equal(fixtures[3].umpireTeamId, 'C');
  for (const field of ['team1Planned', 'team2Planned', 'umpireTeamPlanned'])
    assert.equal(fixtures[3][field], original[field]);
  assert.equal((await refreshCalculatedFixtures(ops, 68)).changes.length, 0);
});

test('prediction resolves an unbeatable leader with two-point scoring, not an arbitrary current runner-up', () => {
  const fixtures = [
    game(1, 'A', 'B', 10, 5),
    game(2, 'A', 'C', 9, 3),
    game(3, 'B', 'C', null, null),
  ];
  const resolve = createCalculatedResolver(fixtures, points);
  assert.equal(resolve('~group:1/p:1'), 'A');
  assert.equal(resolve('~group:1/p:2'), 'PENDING');
  assert.equal(resolve('~group:1/p:3'), 'PENDING');
});

test('head-to-head can clinch a two-team tie but not an unresolved three-way tie', () => {
  const resolve = createCalculatedResolver(
    [
      game(1, 'A', 'B', 10, 5),
      game(2, 'A', 'C', 9, 3),
      game(3, 'B', 'C', null, null),
      game(4, 'B', 'C', 5, 1),
    ],
    points
  );
  assert.equal(resolve('~group:1/p:1'), 'A');
  const tied = createCalculatedResolver(
    [
      game(1, 'A', 'B', 1, 0),
      game(2, 'B', 'C', 1, 0),
      game(3, 'C', 'A', null, null),
    ],
    points
  );
  assert.equal(tied('~group:1/p:1'), 'PENDING');
});

test('completed ties use overall scoring, genuinely tied slots become CONTESTED on both sides', () => {
  const fixtures = [
    game(1, 'A', 'B', 5, 5),
    game(2, 'A', 'C', 10, 1),
    game(3, 'B', 'C', 6, 1),
  ];
  assert.equal(createCalculatedResolver(fixtures, points)('~group:1/p:2'), 'B');
  fixtures[2].points1 = 10;
  const resolve = createCalculatedResolver(fixtures, points);
  assert.equal(resolve('~group:1/p:1'), 'CONTESTED');
  assert.equal(resolve('~group:1/p:2'), 'CONTESTED');
  assert.equal(resolve('~group:1/p:3'), 'C');
});

test('winner and loser references require a final result, including extra time and penalties', () => {
  const fixture = game(1, 'A', 'B', 5, 5);
  fixture.outcome = 'in-progress';
  assert.equal(
    createCalculatedResolver([fixture], points)('~match:1/p:1'),
    'PENDING'
  );
  fixture.outcome = 'played';
  assert.equal(
    createCalculatedResolver([fixture], points)('~match:1/p:1'),
    'CONTESTED'
  );
  fixture.goals2Penalties = 1;
  const resolve = createCalculatedResolver([fixture], points);
  assert.equal(resolve('~match:1/p:1'), 'B');
  assert.equal(resolve('~match:1/p:2'), 'A');
});

test('verification holds completed groups, approval persists, correcting results invalidates it', async () => {
  const { ops, fixtures } = store(undefined, true);
  await refreshCalculatedFixtures(ops, 68);
  assert.equal(fixtures[3].team1Id, 'PENDING');
  await refreshCalculatedFixtures(ops, 68, {
    mode: 'resolve',
    approveGroups: true,
  });
  assert.equal(fixtures[3].team1Id, 'A');
  await refreshCalculatedFixtures(ops, 68);
  assert.equal(fixtures[3].team1Id, 'A');
  fixtures[0].points1 = 1;
  await refreshCalculatedFixtures(ops, 68);
  assert.equal(fixtures[3].team1Id, 'PENDING');
});

test('forced placeholders affect calculated team and umpire slots; category scope and started fixtures are protected', async () => {
  const started = {
    ...knockout(),
    id: 16,
    started: '2026-10-03',
    team1Id: 'A',
  };
  const other = { ...knockout(), id: 17, category: 'HURLING', team1Id: 'X' };
  const { ops, fixtures } = store([...games(), knockout(), started, other]);
  const result = await refreshCalculatedFixtures(ops, 68, {
    category: 'CAMOGIE',
    mode: 'contested',
  });
  assert.deepEqual(result.skippedFixtureIds, [16]);
  assert.equal(fixtures[3].umpireTeamId, 'CONTESTED');
  assert.equal(fixtures[4].team1Id, 'A');
  assert.equal(fixtures[5].team1Id, 'X');
  await refreshCalculatedFixtures(ops, 68, {
    category: 'CAMOGIE',
    mode: 'pending',
  });
  assert.equal(fixtures[3].team2Id, 'PENDING');
});

test('match-based umpire assignments resolve and corrected group results repair stale assignments', async () => {
  const { ops, fixtures } = store();
  fixtures[3].umpireTeamPlanned = '~match:1/p:2';
  await refreshCalculatedFixtures(ops, 68);
  assert.equal(fixtures[3].umpireTeamId, 'B');
  fixtures[0].points2 = 20;
  await refreshCalculatedFixtures(ops, 68);
  assert.equal(fixtures[3].team1Id, 'B');
  assert.equal(fixtures[3].umpireTeamId, 'A');
});
