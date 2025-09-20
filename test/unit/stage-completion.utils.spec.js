const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveGroupPlaceholderAssignments,
  deriveCategoryPlaceholderAssignments,
  sortCategoryStandings,
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

