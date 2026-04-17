import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveGroupPlaceholderAssignments,
  derivePredictiveGroupPlaceholderAssignments,
  deriveCategoryPlaceholderAssignments,
  deriveWorstCategoryPlaceholderAssignments,
  sortCategoryStandings,
  evaluatePlaceholderDelta,
  deriveBestPlaceholderAssignments,
  deriveWorstPlaceholderAssignments,
  planGroupZeroAssignments,
} from '../../src/api/services/fixtures/stage-completion-utils';

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

test('derivePredictiveGroupPlaceholderAssignments resolves an early-clinched leader', () => {
  const assignments = derivePredictiveGroupPlaceholderAssignments({
    stage: 'group',
    groupNumber: 1,
    totalPositions: 2,
    standings: [
      { team: 'A', TotalPoints: 12, PointsDifference: 20, PointsFrom: 40 },
      { team: 'B', TotalPoints: 6, PointsDifference: 8, PointsFrom: 30 },
      { team: 'C', TotalPoints: 4, PointsDifference: 1, PointsFrom: 18 },
    ],
    fixtures: [
      { team1: 'A', team2: 'B', goals1: 1, points1: 5, goals2: 0, points2: 4 },
      { team1: 'A', team2: 'C', goals1: 1, points1: 2, goals2: 0, points2: 3 },
      {
        team1: 'B',
        team2: 'C',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
      {
        team1: 'A',
        team2: 'D',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
      {
        team1: 'B',
        team2: 'D',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
      {
        team1: 'C',
        team2: 'D',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
    ],
  });

  assert.deepEqual(assignments, [
    { placeholder: '~group:1/p:1', teamId: 'A' },
    { placeholder: '~group:1/p:2', teamId: null },
  ]);
});

test('derivePredictiveGroupPlaceholderAssignments leaves a position unresolved when the team can still move', () => {
  const assignments = derivePredictiveGroupPlaceholderAssignments({
    stage: 'group',
    groupNumber: 2,
    totalPositions: 2,
    standings: [
      { team: 'A', TotalPoints: 6, PointsDifference: 10, PointsFrom: 20 },
      { team: 'B', TotalPoints: 4, PointsDifference: 2, PointsFrom: 15 },
      { team: 'C', TotalPoints: 3, PointsDifference: 1, PointsFrom: 12 },
    ],
    fixtures: [
      { team1: 'A', team2: 'B', goals1: 1, points1: 4, goals2: 1, points2: 2 },
      {
        team1: 'A',
        team2: 'C',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
      {
        team1: 'B',
        team2: 'C',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
    ],
  });

  assert.deepEqual(assignments, [
    { placeholder: '~group:2/p:1', teamId: null },
    { placeholder: '~group:2/p:2', teamId: null },
  ]);
});

test('derivePredictiveGroupPlaceholderAssignments uses completed head-to-head to lock equal-points order', () => {
  const assignments = derivePredictiveGroupPlaceholderAssignments({
    stage: 'group',
    groupNumber: 3,
    totalPositions: 2,
    standings: [
      {
        team: 'A',
        TotalPoints: 6,
        PointsDifference: 10,
        PointsFrom: 20,
        position: 1,
      },
      {
        team: 'B',
        TotalPoints: 3,
        PointsDifference: 5,
        PointsFrom: 18,
        position: 2,
      },
      {
        team: 'C',
        TotalPoints: 0,
        PointsDifference: -15,
        PointsFrom: 6,
        position: 3,
      },
    ],
    fixtures: [
      { team1: 'A', team2: 'B', goals1: 1, points1: 2, goals2: 0, points2: 4 },
      { team1: 'A', team2: 'C', goals1: 1, points1: 3, goals2: 0, points2: 1 },
      {
        team1: 'B',
        team2: 'C',
        goals1: null,
        points1: null,
        goals2: null,
        points2: null,
      },
    ],
  });

  assert.deepEqual(assignments, [
    { placeholder: '~group:3/p:1', teamId: 'A' },
    { placeholder: '~group:3/p:2', teamId: null },
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
  assert.deepEqual(
    ordered.map((row) => row.team),
    ['C', 'B', 'D', 'A']
  );
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

test('deriveCategoryPlaceholderAssignments re-scores the top N per group when group sizes differ', () => {
  const standings = [
    {
      team: 'A1',
      TotalPoints: 6,
      PointsDifference: 6,
      PointsFrom: 6,
      grp: 1,
    },
    {
      team: 'A2',
      TotalPoints: 3,
      PointsDifference: 0,
      PointsFrom: 3,
      grp: 1,
    },
    {
      team: 'A3',
      TotalPoints: 0,
      PointsDifference: -6,
      PointsFrom: 0,
      grp: 1,
    },
    {
      team: 'B1',
      TotalPoints: 9,
      PointsDifference: 9,
      PointsFrom: 9,
      grp: 2,
    },
    {
      team: 'B2',
      TotalPoints: 6,
      PointsDifference: 3,
      PointsFrom: 6,
      grp: 2,
    },
    {
      team: 'B3',
      TotalPoints: 3,
      PointsDifference: -3,
      PointsFrom: 3,
      grp: 2,
    },
    {
      team: 'B4',
      TotalPoints: 0,
      PointsDifference: -9,
      PointsFrom: 0,
      grp: 2,
    },
    {
      team: 'C1',
      TotalPoints: 9,
      PointsDifference: 9,
      PointsFrom: 9,
      grp: 3,
    },
    {
      team: 'C2',
      TotalPoints: 6,
      PointsDifference: 3,
      PointsFrom: 6,
      grp: 3,
    },
    {
      team: 'C3',
      TotalPoints: 3,
      PointsDifference: -3,
      PointsFrom: 3,
      grp: 3,
    },
    {
      team: 'C4',
      TotalPoints: 0,
      PointsDifference: -9,
      PointsFrom: 0,
      grp: 3,
    },
  ];
  const fixtures = [
    {
      groupNumber: 1,
      team1: 'A1',
      team2: 'A2',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 1,
      team1: 'A1',
      team2: 'A3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 1,
      team1: 'A2',
      team2: 'A3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B1',
      team2: 'B2',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B1',
      team2: 'B3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B1',
      team2: 'B4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B2',
      team2: 'B3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B2',
      team2: 'B4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B3',
      team2: 'B4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C1',
      team2: 'C2',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C1',
      team2: 'C3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C1',
      team2: 'C4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C2',
      team2: 'C3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C2',
      team2: 'C4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C3',
      team2: 'C4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
  ];

  const assignments = deriveCategoryPlaceholderAssignments({
    standings,
    totalPositions: 11,
    fixtures,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~group:0/p:1', teamId: 'A1' },
    { placeholder: '~group:0/p:2', teamId: 'B1' },
    { placeholder: '~group:0/p:3', teamId: 'C1' },
    { placeholder: '~group:0/p:4', teamId: 'A2' },
    { placeholder: '~group:0/p:5', teamId: 'B2' },
    { placeholder: '~group:0/p:6', teamId: 'C2' },
    { placeholder: '~group:0/p:7', teamId: 'A3' },
    { placeholder: '~group:0/p:8', teamId: 'B3' },
    { placeholder: '~group:0/p:9', teamId: 'C3' },
    { placeholder: '~group:0/p:10', teamId: 'B4' },
    { placeholder: '~group:0/p:11', teamId: 'C4' },
  ]);
});

test('deriveBestPlaceholderAssignments ranks teams for a given position', () => {
  const standings = [
    {
      team: 'G1',
      TotalPoints: 9,
      PointsDifference: 20,
      PointsFrom: 40,
      grp: 1,
    },
    {
      team: 'G2',
      TotalPoints: 6,
      PointsDifference: 18,
      PointsFrom: 42,
      grp: 2,
    },
    {
      team: 'G3',
      TotalPoints: 6,
      PointsDifference: 12,
      PointsFrom: 39,
      grp: 3,
    },
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
  const assignments = deriveBestPlaceholderAssignments({
    position: 0,
    standings: [],
  });
  assert.deepEqual(assignments, []);
});

test('deriveWorstPlaceholderAssignments ranks teams in reverse for a given position', () => {
  const standings = [
    {
      team: 'G1',
      TotalPoints: 9,
      PointsDifference: 20,
      PointsFrom: 40,
      grp: 1,
    },
    {
      team: 'G2',
      TotalPoints: 6,
      PointsDifference: 18,
      PointsFrom: 42,
      grp: 2,
    },
    {
      team: 'G3',
      TotalPoints: 6,
      PointsDifference: 12,
      PointsFrom: 39,
      grp: 3,
    },
  ];

  const assignments = deriveWorstPlaceholderAssignments({
    position: 2,
    standings,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~worst:1/p:2', teamId: 'G3' },
    { placeholder: '~worst:2/p:2', teamId: 'G2' },
    { placeholder: '~worst:3/p:2', teamId: 'G1' },
  ]);
});

test('deriveWorstPlaceholderAssignments returns empty list when position invalid', () => {
  const assignments = deriveWorstPlaceholderAssignments({
    position: 0,
    standings: [],
  });
  assert.deepEqual(assignments, []);
});

test('deriveWorstCategoryPlaceholderAssignments orders standings from bottom up', () => {
  const standings = [
    { team: 'A', TotalPoints: 9, PointsDifference: 20, PointsFrom: 40, grp: 1 },
    { team: 'B', TotalPoints: 6, PointsDifference: 18, PointsFrom: 42, grp: 2 },
    { team: 'C', TotalPoints: 3, PointsDifference: 5, PointsFrom: 20, grp: 3 },
  ];

  const assignments = deriveWorstCategoryPlaceholderAssignments({
    standings,
    totalPositions: 2,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~worst:1/p:0', teamId: 'C' },
    { placeholder: '~worst:2/p:0', teamId: 'B' },
  ]);
});

test('deriveWorstCategoryPlaceholderAssignments mirrors the adjusted uneven group-size overall order', () => {
  const standings = [
    {
      team: 'A1',
      TotalPoints: 6,
      PointsDifference: 6,
      PointsFrom: 6,
      grp: 1,
    },
    {
      team: 'A2',
      TotalPoints: 3,
      PointsDifference: 0,
      PointsFrom: 3,
      grp: 1,
    },
    {
      team: 'A3',
      TotalPoints: 0,
      PointsDifference: -6,
      PointsFrom: 0,
      grp: 1,
    },
    {
      team: 'B1',
      TotalPoints: 9,
      PointsDifference: 9,
      PointsFrom: 9,
      grp: 2,
    },
    {
      team: 'B2',
      TotalPoints: 6,
      PointsDifference: 3,
      PointsFrom: 6,
      grp: 2,
    },
    {
      team: 'B3',
      TotalPoints: 3,
      PointsDifference: -3,
      PointsFrom: 3,
      grp: 2,
    },
    {
      team: 'B4',
      TotalPoints: 0,
      PointsDifference: -9,
      PointsFrom: 0,
      grp: 2,
    },
    {
      team: 'C1',
      TotalPoints: 9,
      PointsDifference: 9,
      PointsFrom: 9,
      grp: 3,
    },
    {
      team: 'C2',
      TotalPoints: 6,
      PointsDifference: 3,
      PointsFrom: 6,
      grp: 3,
    },
    {
      team: 'C3',
      TotalPoints: 3,
      PointsDifference: -3,
      PointsFrom: 3,
      grp: 3,
    },
    {
      team: 'C4',
      TotalPoints: 0,
      PointsDifference: -9,
      PointsFrom: 0,
      grp: 3,
    },
  ];
  const fixtures = [
    {
      groupNumber: 1,
      team1: 'A1',
      team2: 'A2',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 1,
      team1: 'A1',
      team2: 'A3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 1,
      team1: 'A2',
      team2: 'A3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B1',
      team2: 'B2',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B1',
      team2: 'B3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B1',
      team2: 'B4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B2',
      team2: 'B3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B2',
      team2: 'B4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 2,
      team1: 'B3',
      team2: 'B4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C1',
      team2: 'C2',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C1',
      team2: 'C3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C1',
      team2: 'C4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C2',
      team2: 'C3',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C2',
      team2: 'C4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
    {
      groupNumber: 3,
      team1: 'C3',
      team2: 'C4',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'played',
    },
  ];

  const assignments = deriveWorstCategoryPlaceholderAssignments({
    standings,
    totalPositions: 5,
    fixtures,
  });

  assert.deepEqual(assignments, [
    { placeholder: '~worst:1/p:0', teamId: 'C4' },
    { placeholder: '~worst:2/p:0', teamId: 'B4' },
    { placeholder: '~worst:3/p:0', teamId: 'C3' },
    { placeholder: '~worst:4/p:0', teamId: 'B3' },
    { placeholder: '~worst:5/p:0', teamId: 'A3' },
  ]);
});

test('planGroupZeroAssignments skips when matches remain', () => {
  const plan = planGroupZeroAssignments({
    remainingMatches: 2,
    standings: [],
    totalPositions: 3,
  });

  assert.deepEqual(plan, {
    shouldSkip: true,
    reason: 'remaining-matches',
    remainingMatches: 2,
    assignments: [],
  });
});

test('planGroupZeroAssignments returns assignments when no matches remain', () => {
  const standings = [
    {
      team: 'G1',
      TotalPoints: 9,
      PointsDifference: 20,
      PointsFrom: 40,
      grp: 1,
    },
    {
      team: 'G2',
      TotalPoints: 6,
      PointsDifference: 18,
      PointsFrom: 42,
      grp: 2,
    },
  ];

  const plan = planGroupZeroAssignments({
    remainingMatches: 0,
    standings,
    totalPositions: 2,
  });

  assert.equal(plan.shouldSkip, false);
  assert.deepEqual(plan.assignments, [
    { placeholder: '~group:0/p:1', teamId: 'G1' },
    { placeholder: '~group:0/p:2', teamId: 'G2' },
  ]);
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
