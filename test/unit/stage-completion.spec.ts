import test from 'node:test';
import assert from 'node:assert/strict';

import stageCompletionFactory from '../../src/api/services/fixtures/stage-completion';

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
