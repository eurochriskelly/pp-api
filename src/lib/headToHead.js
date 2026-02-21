/**
 * Head-to-Head Tiebreaker Calculation for Gaelic Games Europe
 *
 * Implements the GGE tiebreaker hierarchy:
 * 1. Total Points (overall)
 * 2. Head-to-head Points (among tied teams)
 * 3. Head-to-head Goal Difference (among tied teams)
 * 4. Head-to-head Goals Scored (among tied teams)
 * 5. Overall Goal Difference (all matches)
 * 6. Joint positions allowed (no play-off required)
 */

/**
 * Calculate head-to-head statistics for a group of tied teams
 * @param {Array} tiedTeams - Array of team objects with teamId
 * @param {Array} h2hMatches - Array of head-to-head match results
 * @returns {Array} Teams with head-to-head stats sorted by H2H criteria
 */
function calculateHeadToHeadStats(tiedTeams, h2hMatches) {
  const teamIds = new Set(tiedTeams.map((t) => t.team));
  const stats = {};

  // Initialize stats for all tied teams
  tiedTeams.forEach((team) => {
    stats[team.team] = {
      ...team,
      h2hPlayed: 0,
      h2hWins: 0,
      h2hDraws: 0,
      h2hLosses: 0,
      h2hPoints: 0,
      h2hScoreFor: 0,
      h2hScoreAgainst: 0,
      h2hDiff: 0,
    };
  });

  // Process only matches between tied teams
  h2hMatches.forEach((match) => {
    // Only count matches where both teams are in the tie group
    if (!teamIds.has(match.teamA) || !teamIds.has(match.teamB)) {
      return;
    }

    const teamA = stats[match.teamA];
    const teamB = stats[match.teamB];

    if (!teamA || !teamB) return;

    // Update played count
    teamA.h2hPlayed++;
    teamB.h2hPlayed++;

    // Update scores
    teamA.h2hScoreFor += match.scoreA;
    teamA.h2hScoreAgainst += match.scoreB;
    teamB.h2hScoreFor += match.scoreB;
    teamB.h2hScoreAgainst += match.scoreA;

    // Determine result and update points
    if (match.scoreA > match.scoreB) {
      teamA.h2hWins++;
      teamA.h2hPoints += 2; // GGE uses 2 points for a win
      teamB.h2hLosses++;
    } else if (match.scoreA < match.scoreB) {
      teamB.h2hWins++;
      teamB.h2hPoints += 2;
      teamA.h2hLosses++;
    } else {
      teamA.h2hDraws++;
      teamA.h2hPoints += 1;
      teamB.h2hDraws++;
      teamB.h2hPoints += 1;
    }
  });

  // Calculate differences
  Object.values(stats).forEach((stat) => {
    stat.h2hDiff = stat.h2hScoreFor - stat.h2hScoreAgainst;
  });

  // Sort by head-to-head criteria
  const sorted = Object.values(stats).sort((a, b) => {
    // 1. Head-to-head Points
    if (b.h2hPoints !== a.h2hPoints) {
      return b.h2hPoints - a.h2hPoints;
    }
    // 2. Head-to-head Goal Difference
    if (b.h2hDiff !== a.h2hDiff) {
      return b.h2hDiff - a.h2hDiff;
    }
    // 3. Head-to-head Goals Scored
    if (b.h2hScoreFor !== a.h2hScoreFor) {
      return b.h2hScoreFor - a.h2hScoreFor;
    }
    return 0;
  });

  return sorted;
}

/**
 * Group teams by head-to-head stats to identify sub-ties
 * @param {Array} h2hSorted - Teams sorted by H2H stats
 * @returns {Array} Array of groups (each group is an array of tied teams)
 */
function groupByH2HStats(h2hSorted) {
  if (h2hSorted.length === 0) return [];

  const groups = [];
  let currentGroup = [h2hSorted[0]];

  for (let i = 1; i < h2hSorted.length; i++) {
    const prev = h2hSorted[i - 1];
    const curr = h2hSorted[i];

    // Check if stats are identical
    if (
      prev.h2hPoints === curr.h2hPoints &&
      prev.h2hDiff === curr.h2hDiff &&
      prev.h2hScoreFor === curr.h2hScoreFor
    ) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);
  return groups;
}

/**
 * Apply overall stats tiebreaker to teams still tied after head-to-head
 * @param {Array} teams - Teams still tied after H2H
 * @returns {Array} Teams sorted by overall stats
 */
function applyOverallTiebreaker(teams) {
  return teams.sort((a, b) => {
    // 1. Overall Points Difference
    if (b.PointsDifference !== a.PointsDifference) {
      return b.PointsDifference - a.PointsDifference;
    }
    // 2. Overall Points From (scored)
    if (b.PointsFrom !== a.PointsFrom) {
      return b.PointsFrom - a.PointsFrom;
    }
    return 0;
  });
}

/**
 * Resolve a tie group (2+ teams with same total points)
 * @param {Array} tiedTeams - Teams tied on total points
 * @param {Array} h2hMatches - All head-to-head match results
 * @param {boolean} allowJointPositions - Whether to allow joint positions
 * @returns {Array} Resolved teams with their final positions
 */
function resolveTieGroup(tiedTeams, h2hMatches, allowJointPositions = true) {
  // Calculate head-to-head stats
  const h2hSorted = calculateHeadToHeadStats(tiedTeams, h2hMatches);

  // Group by H2H stats to identify sub-ties
  const h2hGroups = groupByH2HStats(h2hSorted);

  const result = [];

  for (const group of h2hGroups) {
    if (group.length === 1) {
      // Clear winner in this subgroup
      result.push(group[0]);
    } else {
      // Still tied after head-to-head
      if (allowJointPositions) {
        // Gaelic Games Europe allows joint positions
        // Keep them in the order they are (already sorted by H2H)
        // They will share the same position
        result.push(...group);
      } else {
        // Fall back to overall stats
        const resolvedByOverall = applyOverallTiebreaker(group);
        result.push(...resolvedByOverall);
      }
    }
  }

  return result;
}

/**
 * Apply head-to-head tiebreaker to full standings
 * @param {Array} standings - Base standings from SQL (sorted by TotalPoints, PointsDifference, PointsFrom)
 * @param {Array} h2hMatches - All head-to-head match results
 * @param {boolean} allowJointPositions - Whether to allow joint positions (default: true for GGE)
 * @returns {Array} Standings with head-to-head tiebreaker applied and positions assigned
 */
function applyHeadToHeadTiebreaker(
  standings,
  h2hMatches,
  allowJointPositions = true
) {
  if (!standings || standings.length === 0) {
    return [];
  }

  // Group teams by TotalPoints to identify ties
  const pointsGroups = new Map();

  standings.forEach((team) => {
    const points = team.TotalPoints;
    if (!pointsGroups.has(points)) {
      pointsGroups.set(points, []);
    }
    pointsGroups.get(points).push(team);
  });

  // Sort points in descending order
  const sortedPoints = Array.from(pointsGroups.keys()).sort((a, b) => b - a);

  const result = [];
  let currentPosition = 1;

  for (const points of sortedPoints) {
    const tiedTeams = pointsGroups.get(points);

    if (tiedTeams.length === 1) {
      // No tie - assign position and increment
      result.push({
        ...tiedTeams[0],
        position: currentPosition,
        jointPosition: false,
      });
      currentPosition++;
    } else {
      // Multiple teams tied on points - apply head-to-head
      const resolvedTeams = resolveTieGroup(
        tiedTeams,
        h2hMatches,
        allowJointPositions
      );

      // Assign positions
      let jointStartPosition = currentPosition;
      let jointCount = 0;

      for (let i = 0; i < resolvedTeams.length; i++) {
        const team = resolvedTeams[i];
        let isJoint = false;

        // Check if this team has identical stats to previous team
        if (i > 0) {
          const prev = resolvedTeams[i - 1];
          const sameH2H =
            team.h2hPoints === prev.h2hPoints &&
            team.h2hDiff === prev.h2hDiff &&
            team.h2hScoreFor === prev.h2hScoreFor;
          const sameOverall =
            team.PointsDifference === prev.PointsDifference &&
            team.PointsFrom === prev.PointsFrom;

          if (sameH2H && (allowJointPositions || sameOverall)) {
            isJoint = true;
            jointCount++;
          } else {
            // New distinct position - move to next position
            if (jointCount > 0) {
              // We had a joint position, skip ahead
              currentPosition = jointStartPosition + jointCount + 1;
            } else {
              currentPosition++;
            }
            jointStartPosition = currentPosition;
            jointCount = 0;
          }
        }

        result.push({
          ...team,
          position: isJoint ? jointStartPosition : currentPosition,
          jointPosition: isJoint,
          h2hStats: {
            played: team.h2hPlayed || 0,
            wins: team.h2hWins || 0,
            draws: team.h2hDraws || 0,
            losses: team.h2hLosses || 0,
            points: team.h2hPoints || 0,
            for: team.h2hScoreFor || 0,
            against: team.h2hScoreAgainst || 0,
            diff: team.h2hDiff || 0,
          },
        });
      }

      // Set up position for next points group
      if (jointCount > 0) {
        // Had a joint position at the end
        currentPosition = jointStartPosition + jointCount + 1;
      } else {
        // Last position was not joint, just increment
        currentPosition++;
      }
    }
  }

  return result;
}

/**
 * Extract head-to-head matches from raw query results
 * @param {Array} rawResults - Query results containing standings and match data
 * @returns {Array} Clean array of head-to-head matches
 */
function extractH2HMatches(rawResults) {
  if (!rawResults || rawResults.length === 0) return [];

  const matches = new Map();

  rawResults.forEach((row) => {
    // Check if this row has head-to-head match data
    if (
      row.h2hTeamA &&
      row.h2hTeamB &&
      row.h2hScoreA !== undefined &&
      row.h2hScoreB !== undefined
    ) {
      // Create unique key for this match (sorted to avoid duplicates)
      const teams = [row.h2hTeamA, row.h2hTeamB].sort();
      const key = `${teams[0]}-${teams[1]}`;

      if (!matches.has(key)) {
        matches.set(key, {
          teamA: row.h2hTeamA,
          teamB: row.h2hTeamB,
          scoreA: row.h2hScoreA,
          scoreB: row.h2hScoreB,
        });
      }
    }
  });

  return Array.from(matches.values());
}

/**
 * Clean raw standings data to remove H2H columns
 * @param {Array} rawResults - Query results
 * @returns {Array} Clean standings without H2H columns
 */
function cleanStandingsData(rawResults) {
  return rawResults.map((row) => ({
    category: row.category,
    grp: row.grp,
    team: row.team,
    tournamentId: row.tournamentId,
    MatchesPlayed: row.MatchesPlayed,
    Wins: row.Wins,
    Draws: row.Draws,
    Losses: row.Losses,
    PointsFrom: row.PointsFrom,
    PointsDifference: row.PointsDifference,
    TotalPoints: row.TotalPoints,
  }));
}

module.exports = {
  calculateHeadToHeadStats,
  applyHeadToHeadTiebreaker,
  extractH2HMatches,
  cleanStandingsData,
  groupByH2HStats,
  resolveTieGroup,
  applyOverallTiebreaker,
};
