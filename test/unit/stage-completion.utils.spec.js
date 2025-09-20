const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveGroupPlaceholderAssignments,
  deriveCategoryPlaceholderAssignments,
  sortCategoryStandings,
  evaluatePlaceholderDelta,
  deriveBestPlaceholderAssignments,
} = require('../../src/api/services/fixtures/stage-completion-utils');

test('deriveGroupPlaceholderAssignments maps ordered standings to placeholders', () => {
  const standings = [{ team: 'A' }, { team: 'B' }, { team: 'C' }];
  const assignments = deriveGroupPlaceholderAssignments({
    stage: 'group',
    groupNumber: 3,
    totalPositions: 2,
    standings,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~group:3/p:1', teamId: 'A' },
    { placeholder: '~group:3/p:2', teamId: 'B' },
  ]);
});

test('deriveGroupPlaceholderAssignments fills missing teams with null without collapsing positions', () => {
  const standings = [{ team: 'A' }];
  const assignments = deriveGroupPlaceholderAssignments({
    stage: 'match',
    groupNumber: 10,
    totalPositions: 3,
    standings,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~match:10/p:1', teamId: 'A' },
    { placeholder: '~match:10/p:2', teamId: null },
    { placeholder: '~match:10/p:3', teamId: null },
  ]);
});

test('sortCategoryStandings applies tie-breakers TotalPoints, PointsDifference, PointsFrom, then group', () => {
  const standings = [
    { team: 'A', TotalPoints: 6, PointsDifference: 10, PointsFrom: 30, grp: 2 },
    { team: 'B', TotalPoints: 6, PointsDifference: 12, PointsFrom: 28, grp: 1 },
    { team: 'C', TotalPoints: 9, PointsDifference: 5, PointsFrom: 20, grp: 3 },
    { team: 'D', TotalPoints: 6, PointsDifference: 12, PointsFrom: 28, grp: 4 },
  ];

  const ordered = sortCategoryStandings(standings);
  assert.deepEqual(ordered.map((row) => row.team), ['C', 'B', 'D', 'A']);
});

test('deriveCategoryPlaceholderAssignments orders standings before mapping placeholders', () => {
  const standings = [
    { team: 'A', TotalPoints: 6, PointsDifference: 10, PointsFrom: 30, grp: 2 },
    { team: 'B', TotalPoints: 9, PointsDifference: 5, PointsFrom: 26, grp: 1 },
    { team: 'C', TotalPoints: 6, PointsDifference: 12, PointsFrom: 28, grp: 3 },
  ];

  const assignments = deriveCategoryPlaceholderAssignments({
    standings,
    totalPositions: 3,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~group:0/p:1', teamId: 'B' },
    { placeholder: '~group:0/p:2', teamId: 'C' },
    { placeholder: '~group:0/p:3', teamId: 'A' },
  ]);
});

test('deriveBestPlaceholderAssignments ranks teams for a given position', () => {
  const standings = [
    { team: 'G1', TotalPoints: 9, PointsDifference: 20, PointsFrom: 40, grp: 1 },
    { team: 'G2', TotalPoints: 6, PointsDifference: 18, PointsFrom: 42, grp: 2 },
    { team: 'G3', TotalPoints: 6, PointsDifference: 12, PointsFrom: 39, grp: 3 },
  ];

  const assignments = deriveBestPlaceholderAssignments({
    position: 2,
    standings,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~best:1/p:2', teamId: 'G1' },
    { placeholder: '~best:2/p:2', teamId: 'G2' },
    { placeholder: '~best:3/p:2', teamId: 'G3' },
  ]);
});

test('deriveBestPlaceholderAssignments returns empty list when position invalid', () => {
  const assignments = deriveBestPlaceholderAssignments({ position: 0, standings: [] });
  assert.deepEqual(assignments, []);
});

test('evaluatePlaceholderDelta returns debug entry when no fixtures reference placeholder', () => {
  const entries = evaluatePlaceholderDelta({
    tournamentId: 1,
    category: 'cup',
    teamField: 'team1',
    placeholder: '~match:10/p:1',
    beforeRows: [],
    afterRows: [],
  });

  assert.deepEqual(entries, [
    {
      level: 'debug',
      message:
        "StageCompletion: no fixtures reference team1 placeholder '~match:10/p:1' in tournament 1 / category cup.",
    },
  ]);
});

test('evaluatePlaceholderDelta returns info entry when fixtures removed before logging', () => {
  const entries = evaluatePlaceholderDelta({
    tournamentId: 1,
    category: 'cup',
    teamField: 'team1',
    placeholder: '~match:10/p:1',
    beforeRows: [{ id: 5, teamId: 'A', planned: '~match:10/p:1' }],
    afterRows: [],
  });

  assert.deepEqual(entries, [
    {
      level: 'info',
      message:
        "StageCompletion: fixtures referencing team1 placeholder '~match:10/p:1' were removed before logging (tournament 1, category cup).",
    },
  ]);
});

test('evaluatePlaceholderDelta flags newly referenced placeholder', () => {
  const entries = evaluatePlaceholderDelta({
    tournamentId: 2,
    category: 'shield',
    teamField: 'team2',
    placeholder: '~match:99/p:2',
    beforeRows: [],
    afterRows: [{ id: 7, teamId: 'TEAM-X', planned: '~match:99/p:2' }],
  });

  assert.deepEqual(entries, [
    {
      level: 'info',
      message:
        "StageCompletion: fixture 7 newly references team2 placeholder '~match:99/p:2' (resolved value 'TEAM-X').",
    },
  ]);
});

test('evaluatePlaceholderDelta records resolution for existing fixture', () => {
  const entries = evaluatePlaceholderDelta({
    tournamentId: 3,
    category: 'champ',
    teamField: 'team1',
    placeholder: '~match:88/p:1',
    beforeRows: [{ id: 4, teamId: null, planned: '~match:88/p:1' }],
    afterRows: [{ id: 4, teamId: 'WINNER', planned: '~match:88/p:1' }],
  });

  assert.deepEqual(entries, [
    {
      level: 'info',
      message:
        "StageCompletion: fixture 4 resolved team1 placeholder '~match:88/p:1' from '~match:88/p:1' to 'WINNER'.",
    },
  ]);
});

test('evaluatePlaceholderDelta records placeholder value changes', () => {
  const entries = evaluatePlaceholderDelta({
    tournamentId: 4,
    category: 'plate',
    teamField: 'umpireTeam',
    placeholder: '~match:77/p:2',
    beforeRows: [{ id: 9, teamId: 'OLD', planned: '~match:77/p:2' }],
    afterRows: [{ id: 9, teamId: null, planned: '~match:77/p:2' }],
  });

  assert.deepEqual(entries, [
    {
      level: 'info',
      message:
        "StageCompletion: fixture 9 umpireTeam placeholder '~match:77/p:2' changed value from 'OLD' to '~match:77/p:2'.",
    },
  ]);
});

test('evaluatePlaceholderDelta notes pending and already resolved states', () => {
  const entries = evaluatePlaceholderDelta({
    tournamentId: 5,
    category: 'junior',
    teamField: 'team1',
    placeholder: '~match:22/p:1',
    beforeRows: [
      { id: 11, teamId: null, planned: '~match:22/p:1' },
      { id: 12, teamId: 'TEAM-Z', planned: '~match:22/p:1' },
    ],
    afterRows: [
      { id: 11, teamId: null, planned: '~match:22/p:1' },
      { id: 12, teamId: 'TEAM-Z', planned: '~match:22/p:1' },
    ],
  });

  assert.deepEqual(entries, [
    {
      level: 'debug',
      message:
        "StageCompletion: fixture 11 still pending for team1 placeholder '~match:22/p:1'.",
    },
    {
      level: 'debug',
      message:
        "StageCompletion: fixture 12 already had team1 placeholder '~match:22/p:1' resolved to 'TEAM-Z'.",
    },
  ]);
});
