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
 * Base team standing from database query
 */
export interface TeamStanding {
  category: string;
  grp: string;
  team: string;
  tournamentId: number;
  MatchesPlayed: number;
  Wins: number;
  Draws: number;
  Losses: number;
  PointsFrom: number;
  PointsDifference: number;
  TotalPoints: number;
}

/**
 * Head-to-head match between two teams
 */
export interface H2HMatch {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
}

/**
 * Team standing augmented with head-to-head statistics
 */
export interface H2HStats extends TeamStanding {
  h2hPlayed: number;
  h2hWins: number;
  h2hDraws: number;
  h2hLosses: number;
  h2hPoints: number;
  h2hScoreFor: number;
  h2hScoreAgainst: number;
  h2hDiff: number;
}

/**
 * Team standing with final position information after tiebreaker
 */
export interface ResolvedStanding extends H2HStats {
  position: number;
  jointPosition: boolean;
  h2hStats?: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    for: number;
    against: number;
    diff: number;
  };
}

/**
 * Raw database result containing both standings and H2H match data
 */
export interface RawStandingResult extends TeamStanding {
  h2hTeamA?: string;
  h2hTeamB?: string;
  h2hScoreA?: number;
  h2hScoreB?: number;
}

/**
 * Calculate head-to-head statistics for a group of tied teams
 * @param tiedTeams - Array of team objects with teamId
 * @param h2hMatches - Array of head-to-head match results
 * @returns Teams with head-to-head stats sorted by H2H criteria
 */
export function calculateHeadToHeadStats(
  tiedTeams: TeamStanding[],
  h2hMatches: H2HMatch[]
): H2HStats[] {
  const teamIds = new Set(tiedTeams.map((t) => t.team));
  const stats: Record<string, H2HStats> = {};

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
 * @param h2hSorted - Teams sorted by H2H stats
 * @returns Array of groups (each group is an array of tied teams)
 */
export function groupByH2HStats(h2hSorted: H2HStats[]): H2HStats[][] {
  if (h2hSorted.length === 0) return [];

  const groups: H2HStats[][] = [];
  let currentGroup: H2HStats[] = [h2hSorted[0]];

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
 * Group teams by overall stats to identify sub-ties after overall tiebreaker
 * @param overallSorted - Teams sorted by overall stats
 * @returns Array of groups (each group is an array of tied teams)
 */
export function groupByOverallStats(overallSorted: H2HStats[]): H2HStats[][] {
  if (overallSorted.length === 0) return [];

  const groups: H2HStats[][] = [];
  let currentGroup: H2HStats[] = [overallSorted[0]];

  for (let i = 1; i < overallSorted.length; i++) {
    const prev = overallSorted[i - 1];
    const curr = overallSorted[i];

    // Check if overall stats are identical (PointsDifference, PointsFrom)
    if (
      prev.PointsDifference === curr.PointsDifference &&
      prev.PointsFrom === curr.PointsFrom
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
 * @param teams - Teams still tied after H2H
 * @returns Teams sorted by overall stats
 */
export function applyOverallTiebreaker(teams: H2HStats[]): H2HStats[] {
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
 * @param tiedTeams - Teams tied on total points
 * @param h2hMatches - All head-to-head match results
 * @param allowJointPositions - Whether to allow joint positions
 * @returns Resolved teams with their final positions
 */
export function resolveTieGroup(
  tiedTeams: TeamStanding[],
  h2hMatches: H2HMatch[],
  allowJointPositions = true
): H2HStats[] {
  // Calculate head-to-head stats
  const h2hSorted = calculateHeadToHeadStats(tiedTeams, h2hMatches);

  // Group by H2H stats to identify sub-ties
  const h2hGroups = groupByH2HStats(h2hSorted);

  const result: H2HStats[] = [];

  for (const group of h2hGroups) {
    if (group.length === 1) {
      // Clear winner in this subgroup
      result.push(group[0]);
    } else {
      // Still tied after head-to-head - apply overall tiebreaker
      const resolvedByOverall = applyOverallTiebreaker([...group]);

      // Group by overall stats to see who is still tied
      const overallGroups = groupByOverallStats(resolvedByOverall);

      for (const overallGroup of overallGroups) {
        if (overallGroup.length === 1 || !allowJointPositions) {
          // Single team or joint positions not allowed
          result.push(...overallGroup);
        } else {
          // Still tied after overall stats - mark as joint positions
          result.push(...overallGroup);
        }
      }
    }
  }

  return result;
}

/**
 * Apply head-to-head tiebreaker to full standings
 * @param standings - Base standings from SQL (sorted by TotalPoints, PointsDifference, PointsFrom)
 * @param h2hMatches - All head-to-head match results
 * @param allowJointPositions - Whether to allow joint positions (default: true for GGE)
 * @returns Standings with head-to-head tiebreaker applied and positions assigned
 */
export function applyHeadToHeadTiebreaker(
  standings: TeamStanding[],
  h2hMatches: H2HMatch[],
  allowJointPositions = true
): ResolvedStanding[] {
  if (!standings || standings.length === 0) {
    return [];
  }

  // Group teams by TotalPoints to identify ties
  const pointsGroups = new Map<number, TeamStanding[]>();

  standings.forEach((team) => {
    const points = team.TotalPoints;
    if (!pointsGroups.has(points)) {
      pointsGroups.set(points, []);
    }
    pointsGroups.get(points)!.push(team);
  });

  // Sort points in descending order
  const sortedPoints = Array.from(pointsGroups.keys()).sort((a, b) => b - a);

  const result: ResolvedStanding[] = [];
  let currentPosition = 1;

  for (const points of sortedPoints) {
    const tiedTeams = pointsGroups.get(points)!;

    if (tiedTeams.length === 1) {
      // No tie - assign position and increment
      result.push({
        ...tiedTeams[0],
        h2hPlayed: 0,
        h2hWins: 0,
        h2hDraws: 0,
        h2hLosses: 0,
        h2hPoints: 0,
        h2hScoreFor: 0,
        h2hScoreAgainst: 0,
        h2hDiff: 0,
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
 * @param rawResults - Query results containing standings and match data
 * @returns Clean array of head-to-head matches
 */
export function extractH2HMatches(rawResults: RawStandingResult[]): H2HMatch[] {
  if (!rawResults || rawResults.length === 0) return [];

  const matches = new Map<string, H2HMatch>();

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
 * @param rawResults - Query results
 * @returns Clean standings without H2H columns
 */
export function cleanStandingsData(
  rawResults: RawStandingResult[]
): TeamStanding[] {
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
