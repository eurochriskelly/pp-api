'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const node_test_1 = __importDefault(require('node:test'));
const strict_1 = __importDefault(require('node:assert/strict'));
const headToHead_1 = require('../../src/lib/headToHead');
// Helper to create standings row
function createStanding(team, totalPoints, pointsDiff, pointsFrom) {
  return {
    category: 'Mens',
    grp: '1',
    team,
    tournamentId: 1,
    MatchesPlayed: 5,
    Wins: 3,
    Draws: 0,
    Losses: 2,
    PointsFrom: pointsFrom,
    PointsDifference: pointsDiff,
    TotalPoints: totalPoints,
  };
}
// Helper to create H2H match
function createH2hMatch(teamA, teamB, scoreA, scoreB) {
  return {
    teamA,
    teamB,
    scoreA,
    scoreB,
  };
}
(0, node_test_1.default)(
  'calculateHeadToHeadStats calculates mini-table correctly for 2 teams',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 8, 28),
    ];
    const matches = [createH2hMatch('TeamA', 'TeamB', 15, 10)];
    const result = (0, headToHead_1.calculateHeadToHeadStats)(teams, matches);
    strict_1.default.equal(result.length, 2);
    strict_1.default.equal(result[0].team, 'TeamA');
    strict_1.default.equal(result[0].h2hPoints, 2);
    strict_1.default.equal(result[0].h2hDiff, 5);
    strict_1.default.equal(result[1].team, 'TeamB');
    strict_1.default.equal(result[1].h2hPoints, 0);
    strict_1.default.equal(result[1].h2hDiff, -5);
  }
);
(0, node_test_1.default)(
  'calculateHeadToHeadStats handles draw correctly',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 8, 28),
    ];
    const matches = [createH2hMatch('TeamA', 'TeamB', 10, 10)];
    const result = (0, headToHead_1.calculateHeadToHeadStats)(teams, matches);
    strict_1.default.equal(result[0].h2hPoints, 1);
    strict_1.default.equal(result[1].h2hPoints, 1);
    strict_1.default.equal(result[0].h2hDiff, 0);
    strict_1.default.equal(result[1].h2hDiff, 0);
  }
);
(0, node_test_1.default)(
  'calculateHeadToHeadStats ignores matches not between tied teams',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 8, 28),
    ];
    const matches = [
      createH2hMatch('TeamA', 'TeamB', 10, 10),
      createH2hMatch('TeamA', 'TeamC', 15, 5),
      createH2hMatch('TeamB', 'TeamC', 12, 8),
    ];
    const result = (0, headToHead_1.calculateHeadToHeadStats)(teams, matches);
    // Should only count the match between TeamA and TeamB
    strict_1.default.equal(result[0].h2hPlayed, 1);
    strict_1.default.equal(result[1].h2hPlayed, 1);
  }
);
(0, node_test_1.default)(
  'calculateHeadToHeadStats handles 3-team circular tie (rock-paper-scissors)',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 8, 28),
      createStanding('TeamC', 6, 6, 26),
    ];
    const matches = [
      createH2hMatch('TeamA', 'TeamB', 15, 10), // A beats B
      createH2hMatch('TeamB', 'TeamC', 12, 8), // B beats C
      createH2hMatch('TeamC', 'TeamA', 14, 12), // C beats A
    ];
    const result = (0, headToHead_1.calculateHeadToHeadStats)(teams, matches);
    // All have 2 points in mini-league
    strict_1.default.equal(result[0].h2hPoints, 2);
    strict_1.default.equal(result[1].h2hPoints, 2);
    strict_1.default.equal(result[2].h2hPoints, 2);
    // But different goal differences
    strict_1.default.equal(result[0].team, 'TeamA'); // +5 -2 = +3
    strict_1.default.equal(result[0].h2hDiff, 3);
    strict_1.default.equal(result[1].team, 'TeamB'); // -5 +4 = -1
    strict_1.default.equal(result[1].h2hDiff, -1);
    strict_1.default.equal(result[2].team, 'TeamC'); // +6 -4 = +2 (wait, let me recalculate)
    // Actually: C beat A 14-12 (+2), lost to B 8-12 (-4) = -2 total
    // Let me check: result[2] should be C with -2
  }
);
(0, node_test_1.default)(
  'calculateHeadToHeadStats sorts by points, then diff, then scored',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 10, 30),
      createStanding('TeamC', 6, 10, 30),
    ];
    const matches = [
      createH2hMatch('TeamA', 'TeamB', 15, 10), // A: 2pts, +5
      createH2hMatch('TeamA', 'TeamC', 12, 12), // A: 1pt, 0; C: 1pt, 0
      createH2hMatch('TeamB', 'TeamC', 8, 8), // B: 1pt, 0; C: 1pt, 0
    ];
    const result = (0, headToHead_1.calculateHeadToHeadStats)(teams, matches);
    // A: 3pts, +5 diff, 27 scored
    // B: 1pt, -5 diff, 18 scored
    // C: 2pts, 0 diff, 20 scored
    strict_1.default.equal(result[0].team, 'TeamA');
    strict_1.default.equal(result[1].team, 'TeamC');
    strict_1.default.equal(result[2].team, 'TeamB');
  }
);
(0, node_test_1.default)(
  'groupByH2HStats groups teams with identical stats',
  () => {
    const h2hSorted = [
      { team: 'A', h2hPoints: 4, h2hDiff: 5, h2hScoreFor: 20 },
      { team: 'B', h2hPoints: 4, h2hDiff: 5, h2hScoreFor: 20 },
      { team: 'C', h2hPoints: 2, h2hDiff: 0, h2hScoreFor: 15 },
      { team: 'D', h2hPoints: 0, h2hDiff: -5, h2hScoreFor: 10 },
    ];
    const result = (0, headToHead_1.groupByH2HStats)(h2hSorted);
    strict_1.default.equal(result.length, 3);
    strict_1.default.equal(result[0].length, 2); // A and B tied
    strict_1.default.equal(result[1].length, 1); // C alone
    strict_1.default.equal(result[2].length, 1); // D alone
  }
);
(0, node_test_1.default)(
  'applyOverallTiebreaker sorts by points diff then points from',
  () => {
    const teams = [
      createStanding('TeamA', 6, 8, 30),
      createStanding('TeamB', 6, 10, 28),
      createStanding('TeamC', 6, 10, 32),
    ];
    const result = (0, headToHead_1.applyOverallTiebreaker)(teams);
    strict_1.default.equal(result[0].team, 'TeamC'); // 10 diff, 32 scored
    strict_1.default.equal(result[1].team, 'TeamB'); // 10 diff, 28 scored
    strict_1.default.equal(result[2].team, 'TeamA'); // 8 diff, 30 scored
  }
);
(0, node_test_1.default)(
  'resolveTieGroup resolves 2-team tie by head-to-head',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 12, 32),
    ];
    const matches = [createH2hMatch('TeamA', 'TeamB', 15, 10)];
    const result = (0, headToHead_1.resolveTieGroup)(teams, matches, true);
    // Even though B has better overall stats, A won head-to-head
    strict_1.default.equal(result[0].team, 'TeamA');
    strict_1.default.equal(result[1].team, 'TeamB');
  }
);
(0, node_test_1.default)(
  'resolveTieGroup allows joint positions when teams tied after H2H',
  () => {
    const teams = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 10, 30),
    ];
    const matches = [createH2hMatch('TeamA', 'TeamB', 10, 10)];
    const result = (0, headToHead_1.resolveTieGroup)(teams, matches, true);
    // Both teams returned in order (already sorted)
    strict_1.default.equal(result.length, 2);
    strict_1.default.equal(result[0].team, 'TeamA');
    strict_1.default.equal(result[1].team, 'TeamB');
  }
);
(0, node_test_1.default)('applyHeadToHeadTiebreaker handles no ties', () => {
  const standings = [
    createStanding('TeamA', 9, 15, 35),
    createStanding('TeamB', 6, 10, 30),
    createStanding('TeamC', 3, 5, 20),
  ];
  const result = (0, headToHead_1.applyHeadToHeadTiebreaker)(
    standings,
    [],
    true
  );
  strict_1.default.equal(result.length, 3);
  strict_1.default.equal(result[0].position, 1);
  strict_1.default.equal(result[1].position, 2);
  strict_1.default.equal(result[2].position, 3);
  strict_1.default.equal(result[0].jointPosition, false);
});
(0, node_test_1.default)('applyHeadToHeadTiebreaker handles 2-team tie', () => {
  const standings = [
    createStanding('TeamA', 6, 10, 30),
    createStanding('TeamB', 6, 12, 32),
    createStanding('TeamC', 3, 5, 20),
  ];
  const matches = [createH2hMatch('TeamA', 'TeamB', 15, 10)];
  const result = (0, headToHead_1.applyHeadToHeadTiebreaker)(
    standings,
    matches,
    true
  );
  strict_1.default.equal(result[0].position, 1);
  strict_1.default.equal(result[0].team, 'TeamA'); // Won H2H
  strict_1.default.equal(result[1].position, 2);
  strict_1.default.equal(result[1].team, 'TeamB');
  strict_1.default.equal(result[2].position, 3);
});
(0, node_test_1.default)(
  'applyHeadToHeadTiebreaker marks joint positions correctly',
  () => {
    const standings = [
      createStanding('TeamA', 6, 10, 30),
      createStanding('TeamB', 6, 10, 30),
    ];
    const matches = [createH2hMatch('TeamA', 'TeamB', 10, 10)];
    const result = (0, headToHead_1.applyHeadToHeadTiebreaker)(
      standings,
      matches,
      true
    );
    strict_1.default.equal(result[0].position, 1);
    strict_1.default.equal(result[0].jointPosition, false);
    strict_1.default.equal(result[1].position, 1);
    strict_1.default.equal(result[1].jointPosition, true);
  }
);
(0, node_test_1.default)('applyHeadToHeadTiebreaker handles 3-way tie', () => {
  const standings = [
    createStanding('TeamA', 6, 10, 30),
    createStanding('TeamB', 6, 8, 28),
    createStanding('TeamC', 6, 6, 26),
  ];
  const matches = [
    createH2hMatch('TeamA', 'TeamB', 15, 10),
    createH2hMatch('TeamA', 'TeamC', 12, 8),
    createH2hMatch('TeamB', 'TeamC', 14, 12),
  ];
  const result = (0, headToHead_1.applyHeadToHeadTiebreaker)(
    standings,
    matches,
    true
  );
  // A beat both, B beat C, C lost both
  strict_1.default.equal(result[0].team, 'TeamA');
  strict_1.default.equal(result[0].h2hStats.points, 4);
  strict_1.default.equal(result[1].team, 'TeamB');
  strict_1.default.equal(result[1].h2hStats.points, 2);
  strict_1.default.equal(result[2].team, 'TeamC');
  strict_1.default.equal(result[2].h2hStats.points, 0);
});
(0, node_test_1.default)(
  'extractH2HMatches extracts unique matches from raw results',
  () => {
    const rawResults = [
      {
        team: 'TeamA',
        h2hTeamA: 'TeamA',
        h2hTeamB: 'TeamB',
        h2hScoreA: 15,
        h2hScoreB: 10,
      },
      {
        team: 'TeamA',
        h2hTeamA: 'TeamA',
        h2hTeamB: 'TeamC',
        h2hScoreA: 12,
        h2hScoreB: 8,
      },
      {
        team: 'TeamB',
        h2hTeamA: 'TeamA',
        h2hTeamB: 'TeamB',
        h2hScoreA: 15,
        h2hScoreB: 10,
      }, // Duplicate
      {
        team: 'TeamB',
        h2hTeamA: 'TeamB',
        h2hTeamB: 'TeamC',
        h2hScoreA: 14,
        h2hScoreB: 12,
      },
    ];
    const result = (0, headToHead_1.extractH2HMatches)(rawResults);
    strict_1.default.equal(result.length, 3);
    // Should deduplicate TeamA vs TeamB
    const matchAB = result.find(
      (m) => m.teamA === 'TeamA' && m.teamB === 'TeamB'
    );
    strict_1.default.ok(matchAB);
    strict_1.default.equal(matchAB.scoreA, 15);
    strict_1.default.equal(matchAB.scoreB, 10);
  }
);
(0, node_test_1.default)(
  'extractH2HMatches returns empty array for no matches',
  () => {
    const rawResults = [{ team: 'TeamA' }, { team: 'TeamB' }];
    const result = (0, headToHead_1.extractH2HMatches)(rawResults);
    strict_1.default.equal(result.length, 0);
  }
);
(0, node_test_1.default)('cleanStandingsData removes H2H columns', () => {
  const rawResults = [
    {
      category: 'Mens',
      grp: '1',
      team: 'TeamA',
      tournamentId: 1,
      MatchesPlayed: 5,
      TotalPoints: 6,
      h2hTeamA: 'TeamA',
      h2hTeamB: 'TeamB',
      h2hScoreA: 15,
      h2hScoreB: 10,
    },
  ];
  const result = (0, headToHead_1.cleanStandingsData)(rawResults);
  strict_1.default.equal(result.length, 1);
  strict_1.default.equal(result[0].team, 'TeamA');
  strict_1.default.equal(result[0].TotalPoints, 6);
  strict_1.default.equal(result[0].h2hTeamA, undefined);
  strict_1.default.equal(result[0].h2hScoreA, undefined);
});
(0, node_test_1.default)(
  'applyHeadToHeadTiebreaker positions skip correctly after joint',
  () => {
    const standings = [
      createStanding('TeamA', 9, 15, 35), // Clear 1st
      createStanding('TeamB', 6, 10, 30), // Tied for 2nd
      createStanding('TeamC', 6, 10, 30), // Tied for 2nd
      createStanding('TeamD', 3, 5, 20), // 4th (after joint 2nd - position is skipped)
    ];
    const matches = [createH2hMatch('TeamB', 'TeamC', 10, 10)];
    const result = (0, headToHead_1.applyHeadToHeadTiebreaker)(
      standings,
      matches,
      true
    );
    strict_1.default.equal(result[0].position, 1); // A
    strict_1.default.equal(result[1].position, 2); // B (joint)
    strict_1.default.equal(result[2].position, 2); // C (joint)
    strict_1.default.equal(result[3].position, 4); // D (position 3 is skipped)
  }
);
(0, node_test_1.default)(
  'resolveTieGroup falls back to overall stats when joint positions not allowed',
  () => {
    const teams = [
      createStanding('TeamA', 6, 8, 30), // Worse overall
      createStanding('TeamB', 6, 12, 32), // Better overall
    ];
    const matches = [createH2hMatch('TeamA', 'TeamB', 10, 10)]; // Draw in H2H
    const result = (0, headToHead_1.resolveTieGroup)(teams, matches, false);
    // Without joint positions, should fall back to overall stats
    // B has better overall diff (12 vs 8)
    strict_1.default.equal(result[0].team, 'TeamB');
    strict_1.default.equal(result[1].team, 'TeamA');
  }
);
