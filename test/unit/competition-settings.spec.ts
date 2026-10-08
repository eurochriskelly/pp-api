import test from 'node:test';
import assert from 'node:assert/strict';
import {
  competitionRules,
  getCompetitionSettings,
  tournamentDetailsSchema,
} from '../../src/api/services/tournaments/competition-settings';
import { refreshCalculatedFixtures } from '../../src/api/services/fixtures/calculated-fixtures';
import { calculateHeadToHeadStats } from '../../src/lib/headToHead';
import { calculateStandings } from '../../src/api/services/tournaments/build-report/utils/standingsCalculation';

const settings = [
  {
    category: 'CAMOGIE',
    winPoints: 5,
    drawPoints: 2,
    losePoints: 1,
    verifyGroupStages: true,
  },
  {
    category: 'HURLING',
    winPoints: 0,
    drawPoints: 0,
    losePoints: 0,
    verifyGroupStages: false,
  },
];

test('category scoring preserves zeroes and legacy defaults for new categories', () => {
  const tournament = {
    competitionSettings: JSON.stringify(settings),
    pointsForWin: 3,
    pointsForDraw: 2,
    pointsForLoss: 1,
  };
  assert.deepEqual(competitionRules(tournament, 'hurling').points, {
    win: 0,
    draw: 0,
    loss: 0,
  });
  assert.deepEqual(competitionRules(tournament, 'NEW').points, {
    win: 3,
    draw: 2,
    loss: 1,
  });
  assert.equal(
    getCompetitionSettings(tournament, ['CAMOGIE', 'HURLING', 'NEW']).length,
    3
  );
});

test('validates the edit payload, rejecting duplicate categories and invalid scores', () => {
  assert.equal(
    tournamentDetailsSchema.safeParse({
      competitionSettings: settings,
      codeReferee: '9EFC',
      codeTeam: 'UT28',
      endDate: null,
      lat: 0,
      lon: 0,
    }).success,
    true
  );
  for (const competitionSettings of [
    [settings[0], { ...settings[0], category: 'camogie' }],
    [{ ...settings[0], winPoints: -1 }],
    [{ ...settings[0], verifyGroupStages: 'false' }],
  ]) {
    assert.equal(
      tournamentDetailsSchema.safeParse({ competitionSettings }).success,
      false
    );
  }
});

test('head-to-head uses the selected competition rules', () => {
  const teams = ['A', 'B'].map((team) => ({ team })) as any;
  const stats = calculateHeadToHeadStats(
    teams,
    [{ teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1 }],
    { win: 5, draw: 2, loss: 1 }
  );
  assert.equal(stats.find((s) => s.team === 'A')!.h2hPoints, 5);
  assert.equal(stats.find((s) => s.team === 'B')!.h2hPoints, 1);
});

test('report standings use selected win and loss awards', () => {
  const fixtures: any = {
    stage: {
      group: [
        {
          outcome: 'played',
          pool: 1,
          team1: { name: 'A', total: 2, status: 'won' },
          team2: { name: 'B', total: 1, status: 'lost' },
        },
      ],
    },
  };
  const standings = calculateStandings(
    fixtures,
    [{ group: 1, teams: ['A', 'B'] }],
    { win: 5, draw: 2, loss: 1 }
  );
  assert.equal(standings.byGroup['GP.1'][0].points, 5);
  assert.equal(standings.byGroup['GP.1'][1].points, 1);
});

test('group verification is independent for competitions sharing a tournament', async () => {
  const fixtures = settings.flatMap((setting, index) => [
    {
      id: index * 2 + 1,
      category: setting.category,
      stage: 'group',
      groupNumber: 1,
      team1Id: 'A',
      team2Id: 'B',
      outcome: 'played',
      goals1: 0,
      points1: 2,
      goals2: 0,
      points2: 1,
    },
    {
      id: index * 2 + 2,
      category: setting.category,
      stage: 'cup_finals',
      team1Planned: '~group:1/p:1',
      team1Id: '~group:1/p:1',
      outcome: 'not played',
    },
  ]);
  const changes = await refreshCalculatedFixtures(
    {
      select: async (sql: string) =>
        sql.includes('FROM tournaments')
          ? [{ competitionSettings: settings }]
          : fixtures,
      update: async () => 1,
    } as any,
    58
  );
  assert.equal(
    changes.changes.find((c) => c.fixtureId === 2)!.value,
    'PENDING'
  );
  assert.notEqual(
    changes.changes.find((c) => c.fixtureId === 4)!.value,
    'PENDING'
  );
});

test('skipped wins use one point in head-to-head as in standings', () => {
  const stats = calculateHeadToHeadStats(
    ['A', 'B'].map((team) => ({ team })) as any,
    [{ teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1, outcome: 'skipped' }],
    { win: 5, draw: 2, loss: 0 }
  );
  assert.equal(stats.find((s) => s.team === 'A')!.h2hPoints, 1);
});
