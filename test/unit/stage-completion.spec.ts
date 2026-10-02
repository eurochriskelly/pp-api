import test from 'node:test';
import assert from 'node:assert/strict';

import stageCompletionFactory from '../../src/api/services/fixtures/stage-completion';

test('processStageCompletion assigns head-to-head winners, including corrected results', async () => {
  const updates: Array<{ value: string | null; placeholder: string }> = [];
  let amsterdamWonHeadToHead = false;

  const standings = () => {
    const h2hWinner = amsterdamWonHeadToHead ? 'AMSTERDAM' : 'GRONINGEN';
    const h2hLoser = amsterdamWonHeadToHead ? 'GRONINGEN' : 'AMSTERDAM';
    const fifthWinner = amsterdamWonHeadToHead ? 'EINDHOVEN B' : 'FRANKFURT';
    const fifthLoser = amsterdamWonHeadToHead ? 'FRANKFURT' : 'EINDHOVEN B';

    return [
      {
        team: 'AMSTERDAM',
        grp: 2,
        TotalPoints: 12,
        PointsDifference: 13,
        PointsFrom: 37,
        h2hTeamA: h2hWinner,
        h2hTeamB: h2hLoser,
        h2hScoreA: 5,
        h2hScoreB: 4,
      },
      {
        team: 'GRONINGEN',
        grp: 2,
        TotalPoints: 12,
        PointsDifference: 29,
        PointsFrom: 57,
        h2hTeamA: h2hWinner,
        h2hTeamB: h2hLoser,
        h2hScoreA: 5,
        h2hScoreB: 4,
      },
      {
        team: 'THIRD',
        grp: 2,
        TotalPoints: 9,
        PointsDifference: 1,
        PointsFrom: 30,
      },
      {
        team: 'FOURTH',
        grp: 2,
        TotalPoints: 6,
        PointsDifference: 0,
        PointsFrom: 20,
      },
      {
        team: 'EINDHOVEN B',
        grp: 2,
        TotalPoints: 3,
        PointsDifference: -26,
        PointsFrom: 25,
        h2hTeamA: fifthWinner,
        h2hTeamB: fifthLoser,
        h2hScoreA: 8,
        h2hScoreB: 7,
      },
      {
        team: 'FRANKFURT',
        grp: 2,
        TotalPoints: 3,
        PointsDifference: -17,
        PointsFrom: 33,
        h2hTeamA: fifthWinner,
        h2hTeamB: fifthLoser,
        h2hScoreA: 8,
        h2hScoreB: 7,
      },
    ];
  };

  const processor = stageCompletionFactory({
    dbHelpers: {
      select: async (sql: string) => {
        if (sql.includes('FROM fixtures WHERE id = ?')) {
          return [
            {
              id: 101,
              tournamentId: 67,
              stage: 'group',
              groupNumber: 2,
              category: 'MENS',
            },
          ];
        }
        if (
          sql.includes('count(*) as remaining') &&
          sql.includes('groupNumber = ?')
        ) {
          return [{ remaining: 0 }];
        }
        if (sql.includes('FROM (STANDINGS_H2H) AS h2h_data'))
          return standings();
        if (sql.includes('SELECT team1Id AS team1, team2Id AS team2'))
          return [];
        if (sql.includes('team1Planned LIKE ?')) {
          return [{ maxPos1: 5, maxPos2: 0, maxPosUmp: 0 }];
        }
        if (sql.includes("team1Planned LIKE '~best:%/p:%'"))
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        if (sql.includes("team1Planned LIKE '~worst:%/p:0'"))
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        if (sql.includes("team1Planned LIKE '~worst:%/p:%'"))
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        if (sql.includes("team1Planned LIKE '~group:0/p:%'"))
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        if (sql.includes('SELECT id,') && sql.includes(' AS teamId')) return [];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      update: async (sql: string, params: any[]) => {
        if (sql.includes('UPDATE fixtures SET')) {
          updates.push({ value: params[0], placeholder: params[1] });
        }
        return 1;
      },
    },
    loggers: { II: () => {}, DD: () => {} },
    sqlGroupStandings: () => 'STANDINGS',
    sqlGroupStandingsWithH2H: () => 'STANDINGS_H2H',
    sqlGroupRankings: () => 'RANKINGS',
  });

  await processor.processStageCompletion(101);
  amsterdamWonHeadToHead = true;
  await processor.processStageCompletion(101);

  const assignments = new Map<string, string[]>();
  updates.forEach(({ placeholder, value }) => {
    assignments.set(placeholder, [
      ...(assignments.get(placeholder) || []),
      value || '',
    ]);
  });

  assert.deepEqual(assignments.get('~group:2/p:1'), [
    'GRONINGEN',
    'GRONINGEN',
    'GRONINGEN',
    'AMSTERDAM',
    'AMSTERDAM',
    'AMSTERDAM',
  ]);
  assert.deepEqual(assignments.get('~group:2/p:5'), [
    'FRANKFURT',
    'FRANKFURT',
    'FRANKFURT',
    'EINDHOVEN B',
    'EINDHOVEN B',
    'EINDHOVEN B',
  ]);
});

test('processStageCompletion restores planned ~best placeholders and skips resolving them while category groups remain unresolved', async () => {
  let rankingsQueryCalls = 0;
  const updateCalls: Array<{ sql: string; params: any[] }> = [];

  const processor = stageCompletionFactory({
    dbHelpers: {
      select: async (sql: string, params: any[]) => {
        if (sql.includes('FROM fixtures WHERE id = ?')) {
          return [
            {
              id: 101,
              tournamentId: 38,
              stage: 'group',
              groupNumber: 1,
              category: 'MEN',
            },
          ];
        }

        if (
          sql.includes('count(*) as remaining FROM fixtures') &&
          sql.includes('groupNumber = ?') &&
          !sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 1 }];
        }

        if (sql.includes('FROM (STANDINGS_H2H) AS h2h_data')) {
          return [
            {
              team: 'A',
              grp: 1,
              position: 1,
              TotalPoints: 3,
              PointsDifference: 5,
              PointsFrom: 10,
            },
            {
              team: 'B',
              grp: 1,
              position: 2,
              TotalPoints: 0,
              PointsDifference: -5,
              PointsFrom: 4,
            },
          ];
        }

        if (sql.includes('SELECT team1Id AS team1, team2Id AS team2')) {
          return [
            {
              team1: 'A',
              team2: 'B',
              goals1: 1,
              points1: 2,
              goals2: 0,
              points2: 1,
              outcome: 'played',
            },
            {
              team1: 'A',
              team2: 'C',
              goals1: null,
              points1: null,
              goals2: null,
              points2: null,
              outcome: 'not played',
            },
          ];
        }

        if (sql.includes('team1Planned LIKE ?')) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~best:%/p:%'")) {
          return [{ maxPos1: 1, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes(
            "team1Planned LIKE '~worst:%/p:%' AND team1Planned NOT LIKE '~worst:%/p:0'"
          )
        ) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~worst:%/p:0'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~group:0/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes('count(*) as remaining') &&
          sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 3 }];
        }

        if (sql.includes('RANKINGS_')) {
          rankingsQueryCalls += 1;
          return [];
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
      update: async (sql: string, params: any[]) => {
        updateCalls.push({ sql, params });
        return 1;
      },
    },
    loggers: {
      II: () => {},
      DD: () => {},
    },
    sqlGroupStandings: () => 'STANDINGS',
    sqlGroupStandingsWithH2H: () => 'STANDINGS_H2H',
    sqlGroupRankings: (position: number) => {
      rankingsQueryCalls += 1;
      return `RANKINGS_${position}`;
    },
  });

  const updated = await processor.processStageCompletion(101);

  assert.equal(updated, true);
  assert.equal(rankingsQueryCalls, 0);
  assert.equal(updateCalls.length, 3);
  assert.match(updateCalls[0].sql, /SET team1Id = team1Planned/);
  assert.match(updateCalls[1].sql, /SET team2Id = team2Planned/);
  assert.match(updateCalls[2].sql, /SET umpireTeamId = umpireTeamPlanned/);
});

test('processStageCompletion restores planned ~worst placeholders and skips resolving them while category groups remain unresolved', async () => {
  let rankingsQueryCalls = 0;
  const updateCalls: Array<{ sql: string; params: any[] }> = [];

  const processor = stageCompletionFactory({
    dbHelpers: {
      select: async (sql: string, params: any[]) => {
        if (sql.includes('FROM fixtures WHERE id = ?')) {
          return [
            {
              id: 101,
              tournamentId: 38,
              stage: 'group',
              groupNumber: 1,
              category: 'MEN',
            },
          ];
        }

        if (
          sql.includes('count(*) as remaining FROM fixtures') &&
          sql.includes('groupNumber = ?') &&
          !sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 1 }];
        }

        if (sql.includes('FROM (STANDINGS_H2H) AS h2h_data')) {
          return [
            {
              team: 'A',
              grp: 1,
              position: 1,
              TotalPoints: 3,
              PointsDifference: 5,
              PointsFrom: 10,
            },
            {
              team: 'B',
              grp: 1,
              position: 2,
              TotalPoints: 0,
              PointsDifference: -5,
              PointsFrom: 4,
            },
          ];
        }

        if (sql.includes('SELECT team1Id AS team1, team2Id AS team2')) {
          return [
            {
              team1: 'A',
              team2: 'B',
              goals1: 1,
              points1: 2,
              goals2: 0,
              points2: 1,
              outcome: 'played',
            },
            {
              team1: 'A',
              team2: 'C',
              goals1: null,
              points1: null,
              goals2: null,
              points2: null,
              outcome: 'not played',
            },
          ];
        }

        if (sql.includes('team1Planned LIKE ?')) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~best:%/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes(
            "team1Planned LIKE '~worst:%/p:%' AND team1Planned NOT LIKE '~worst:%/p:0'"
          )
        ) {
          return [{ maxPos1: 1, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~worst:%/p:0'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~group:0/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes('count(*) as remaining') &&
          sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 3 }];
        }

        if (sql.includes('RANKINGS_')) {
          rankingsQueryCalls += 1;
          return [];
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
      update: async (sql: string, params: any[]) => {
        updateCalls.push({ sql, params });
        return 1;
      },
    },
    loggers: {
      II: () => {},
      DD: () => {},
    },
    sqlGroupStandings: () => 'STANDINGS',
    sqlGroupStandingsWithH2H: () => 'STANDINGS_H2H',
    sqlGroupRankings: (position: number) => {
      rankingsQueryCalls += 1;
      return `RANKINGS_${position}`;
    },
  });

  const updated = await processor.processStageCompletion(101);

  assert.equal(updated, true);
  assert.equal(rankingsQueryCalls, 0);
  assert.equal(updateCalls.length, 3);
  assert.match(updateCalls[0].sql, /SET team1Id = team1Planned/);
  assert.match(updateCalls[1].sql, /SET team2Id = team2Planned/);
  assert.match(updateCalls[2].sql, /SET umpireTeamId = umpireTeamPlanned/);
});

test('processStageCompletion restores planned ~worst placeholders and skips resolving them while category groups remain unresolved', async () => {
  let rankingsQueryCalls = 0;
  const updateCalls: Array<{ sql: string; params: any[] }> = [];

  const processor = stageCompletionFactory({
    dbHelpers: {
      select: async (sql: string, params: any[]) => {
        if (sql.includes('FROM fixtures WHERE id = ?')) {
          return [
            {
              id: 101,
              tournamentId: 38,
              stage: 'group',
              groupNumber: 1,
              category: 'MEN',
            },
          ];
        }

        if (
          sql.includes('count(*) as remaining FROM fixtures') &&
          sql.includes('groupNumber = ?') &&
          !sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 1 }];
        }

        if (sql.includes('FROM (STANDINGS_H2H) AS h2h_data')) {
          return [
            {
              team: 'A',
              grp: 1,
              position: 1,
              TotalPoints: 3,
              PointsDifference: 5,
              PointsFrom: 10,
            },
            {
              team: 'B',
              grp: 1,
              position: 2,
              TotalPoints: 0,
              PointsDifference: -5,
              PointsFrom: 4,
            },
          ];
        }

        if (sql.includes('SELECT team1Id AS team1, team2Id AS team2')) {
          return [
            {
              team1: 'A',
              team2: 'B',
              goals1: 1,
              points1: 2,
              goals2: 0,
              points2: 1,
              outcome: 'played',
            },
            {
              team1: 'A',
              team2: 'C',
              goals1: null,
              points1: null,
              goals2: null,
              points2: null,
              outcome: 'not played',
            },
          ];
        }

        if (sql.includes('team1Planned LIKE ?')) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~best:%/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes(
            "team1Planned LIKE '~worst:%/p:%' AND team1Planned NOT LIKE '~worst:%/p:0'"
          )
        ) {
          return [{ maxPos1: 1, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~worst:%/p:0'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~group:0/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes('count(*) as remaining') &&
          sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 3 }];
        }

        if (sql.includes('RANKINGS_')) {
          rankingsQueryCalls += 1;
          return [];
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
      update: async (sql: string, params: any[]) => {
        updateCalls.push({ sql, params });
        return 1;
      },
    },
    loggers: {
      II: () => {},
      DD: () => {},
    },
    sqlGroupStandings: () => 'STANDINGS',
    sqlGroupStandingsWithH2H: () => 'STANDINGS_H2H',
    sqlGroupRankings: (position: number) => {
      rankingsQueryCalls += 1;
      return `RANKINGS_${position}`;
    },
  });

  const updated = await processor.processStageCompletion(101);

  assert.equal(updated, true);
  assert.equal(rankingsQueryCalls, 0);
  assert.equal(updateCalls.length, 3);
  assert.match(updateCalls[0].sql, /SET team1Id = team1Planned/);
  assert.match(updateCalls[1].sql, /SET team2Id = team2Planned/);
  assert.match(updateCalls[2].sql, /SET umpireTeamId = umpireTeamPlanned/);
  assert.match(updateCalls[0].sql, /LIKE '~worst:%\/p:%'/);
  assert.match(updateCalls[1].sql, /LIKE '~worst:%\/p:%'/);
  assert.match(updateCalls[2].sql, /LIKE '~worst:%\/p:%'/);
});

test('processStageCompletion restores planned ~worst:/p:0 placeholders and skips resolving them while category groups remain unresolved', async () => {
  let rankingsQueryCalls = 0;
  const updateCalls: Array<{ sql: string; params: any[] }> = [];

  const processor = stageCompletionFactory({
    dbHelpers: {
      select: async (sql: string, params: any[]) => {
        if (sql.includes('FROM fixtures WHERE id = ?')) {
          return [
            {
              id: 101,
              tournamentId: 38,
              stage: 'group',
              groupNumber: 1,
              category: 'MEN',
            },
          ];
        }

        if (
          sql.includes('count(*) as remaining FROM fixtures') &&
          sql.includes('groupNumber = ?') &&
          !sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 1 }];
        }

        if (sql.includes('FROM (STANDINGS_H2H) AS h2h_data')) {
          return [
            {
              team: 'A',
              grp: 1,
              position: 1,
              TotalPoints: 3,
              PointsDifference: 5,
              PointsFrom: 10,
            },
            {
              team: 'B',
              grp: 1,
              position: 2,
              TotalPoints: 0,
              PointsDifference: -5,
              PointsFrom: 4,
            },
          ];
        }

        if (sql.includes('SELECT team1Id AS team1, team2Id AS team2')) {
          return [
            {
              team1: 'A',
              team2: 'B',
              goals1: 1,
              points1: 2,
              goals2: 0,
              points2: 1,
              outcome: 'played',
            },
            {
              team1: 'A',
              team2: 'C',
              goals1: null,
              points1: null,
              goals2: null,
              points2: null,
              outcome: 'not played',
            },
          ];
        }

        if (sql.includes('team1Planned LIKE ?')) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~best:%/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes(
            "team1Planned LIKE '~worst:%/p:%' AND team1Planned NOT LIKE '~worst:%/p:0'"
          )
        ) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~worst:%/p:0'")) {
          return [{ maxPos1: 2, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (sql.includes("team1Planned LIKE '~group:0/p:%'")) {
          return [{ maxPos1: 0, maxPos2: 0, maxPosUmp: 0 }];
        }

        if (
          sql.includes('count(*) as remaining') &&
          sql.includes("AND stage = 'group'")
        ) {
          return [{ remaining: 3 }];
        }

        if (sql.includes('RANKINGS_')) {
          rankingsQueryCalls += 1;
          return [];
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
      update: async (sql: string, params: any[]) => {
        updateCalls.push({ sql, params });
        return 1;
      },
    },
    loggers: {
      II: () => {},
      DD: () => {},
    },
    sqlGroupStandings: () => 'STANDINGS',
    sqlGroupStandingsWithH2H: () => 'STANDINGS_H2H',
    sqlGroupRankings: (position: number) => {
      rankingsQueryCalls += 1;
      return `RANKINGS_${position}`;
    },
  });

  const updated = await processor.processStageCompletion(101);

  assert.equal(updated, true);
  assert.equal(rankingsQueryCalls, 0);
  assert.equal(updateCalls.length, 3);
  assert.match(updateCalls[0].sql, /SET team1Id = team1Planned/);
  assert.match(updateCalls[1].sql, /SET team2Id = team2Planned/);
  assert.match(updateCalls[2].sql, /SET umpireTeamId = umpireTeamPlanned/);
  assert.match(updateCalls[0].sql, /LIKE '~worst:%\/p:0'/);
  assert.match(updateCalls[1].sql, /LIKE '~worst:%\/p:0'/);
  assert.match(updateCalls[2].sql, /LIKE '~worst:%\/p:0'/);
});
