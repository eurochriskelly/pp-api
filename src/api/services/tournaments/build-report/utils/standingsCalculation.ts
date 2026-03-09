import { applyHeadToHeadTiebreaker } from '../../../../../lib/headToHead';

export interface PointsConfig {
  win: number;
  draw: number;
  loss: number;
}

export interface TeamStats {
  team: string;
  matchesPlayed: number;
  won: number;
  draw: number;
  loss: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
  position?: number;
  jointPosition?: boolean;
  h2hStats?: {
    points: number;
    diff: number;
    for: number;
  };
}

export interface Fixture {
  outcome: string;
  team1: {
    name: string;
    total: number;
    status: string;
    goals: number;
    points: number;
  };
  team2: {
    name: string;
    total: number;
    status: string;
    goals: number;
    points: number;
  };
  pool: number;
}

export interface FixturesData {
  stage: {
    group: Fixture[];
  };
}

export interface GroupInfo {
  group: number;
  teams: string[];
}

export interface StandingsResult {
  byGroup: { [groupName: string]: TeamStats[] };
  allGroups: TeamStats[];
}

/**
 * Calculates group standings from fixture data.
 */
export function calculateStandings(
  fixtures: FixturesData,
  teamsByGroup: GroupInfo[],
  pointsConfig: PointsConfig
): StandingsResult {
  const { win, draw, loss } = pointsConfig;
  const groupFixtures = fixtures.stage.group;

  const standingsByGroup: {
    [groupName: string]: { [teamName: string]: TeamStats };
  } = {};

  teamsByGroup.forEach((group) => {
    const groupName = `GP.${group.group}`;
    standingsByGroup[groupName] = {};
    group.teams.forEach((team) => {
      standingsByGroup[groupName][team] = {
        team: team,
        matchesPlayed: 0,
        won: 0,
        draw: 0,
        loss: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
      };
    });
  });

  const allMatches: Array<{
    groupName: string;
    teamA: string;
    teamB: string;
    scoreA: number;
    scoreB: number;
  }> = [];

  groupFixtures.forEach((fixture) => {
    if (
      fixture.outcome === 'not played' ||
      fixture.outcome === 'skipped' ||
      !fixture.team1.name ||
      !fixture.team2.name
    ) {
      return;
    }

    const groupName = `GP.${fixture.pool}`;
    if (!standingsByGroup[groupName]) {
      standingsByGroup[groupName] = {};
    }

    const team1Name = fixture.team1.name;
    const team2Name = fixture.team2.name;

    if (!standingsByGroup[groupName][team1Name]) {
      standingsByGroup[groupName][team1Name] = {
        team: team1Name,
        matchesPlayed: 0,
        won: 0,
        draw: 0,
        loss: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
      };
    }
    if (!standingsByGroup[groupName][team2Name]) {
      standingsByGroup[groupName][team2Name] = {
        team: team2Name,
        matchesPlayed: 0,
        won: 0,
        draw: 0,
        loss: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
      };
    }

    const team1Stats = standingsByGroup[groupName][team1Name];
    const team2Stats = standingsByGroup[groupName][team2Name];

    allMatches.push({
      groupName,
      teamA: team1Name,
      teamB: team2Name,
      scoreA: fixture.team1.total,
      scoreB: fixture.team2.total,
    });

    if (fixture.team1.status === 'won') {
      team1Stats.matchesPlayed++;
      team2Stats.matchesPlayed++;
      team1Stats.scoreFor += fixture.team1.total;
      team1Stats.scoreAgainst += fixture.team2.total;
      team2Stats.scoreFor += fixture.team2.total;
      team2Stats.scoreAgainst += fixture.team1.total;
      team1Stats.won++;
      team1Stats.points += win;
      team2Stats.loss++;
      team2Stats.points += loss;
    } else if (fixture.team1.status === 'lost') {
      team1Stats.matchesPlayed++;
      team2Stats.matchesPlayed++;
      team1Stats.scoreFor += fixture.team1.total;
      team1Stats.scoreAgainst += fixture.team2.total;
      team2Stats.scoreFor += fixture.team2.total;
      team2Stats.scoreAgainst += fixture.team1.total;
      team1Stats.loss++;
      team1Stats.points += loss;
      team2Stats.won++;
      team2Stats.points += win;
    } else if (fixture.team1.status === 'draw') {
      team1Stats.matchesPlayed++;
      team2Stats.matchesPlayed++;
      team1Stats.scoreFor += fixture.team1.total;
      team1Stats.scoreAgainst += fixture.team2.total;
      team2Stats.scoreFor += fixture.team2.total;
      team2Stats.scoreAgainst += fixture.team1.total;
      team1Stats.draw++;
      team1Stats.points += draw;
      team2Stats.draw++;
      team2Stats.points += draw;
    }
  });

  const finalStandings: StandingsResult = { byGroup: {}, allGroups: [] };
  let allGroupsStandings: TeamStats[] = [];

  for (const groupName in standingsByGroup) {
    const groupStandings = Object.values(standingsByGroup[groupName]);

    groupStandings.forEach((s) => {
      s.scoreDifference = s.scoreFor - s.scoreAgainst;
    });

    const groupMatches = allMatches.filter((m) => m.groupName === groupName);

    const transformedStandings = groupStandings.map((team) => ({
      team: team.team,
      TotalPoints: team.points,
      PointsDifference: team.scoreDifference,
      PointsFrom: team.scoreFor,
      MatchesPlayed: team.matchesPlayed,
      Wins: team.won,
      Draws: team.draw,
      Losses: team.loss,
      category: groupName,
      grp: groupName,
      tournamentId: 0, // placeholder, not used by applyHeadToHeadTiebreaker
    }));

    const transformedMatches = groupMatches.map((match) => ({
      teamA: match.teamA,
      teamB: match.teamB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    }));

    const sortedWithH2H = applyHeadToHeadTiebreaker(
      transformedStandings,
      transformedMatches,
      true
    );

    const sortedGroupStandings: TeamStats[] = sortedWithH2H.map((team) => ({
      team: team.team,
      matchesPlayed: team.MatchesPlayed,
      won: team.Wins,
      draw: team.Draws,
      loss: team.Losses,
      scoreFor: team.PointsFrom,
      scoreAgainst: team.PointsFrom - team.PointsDifference,
      scoreDifference: team.PointsDifference,
      points: team.TotalPoints,
      position: team.position,
      jointPosition: team.jointPosition,
      h2hStats: team.h2hStats,
    }));

    finalStandings.byGroup[groupName] = sortedGroupStandings;
    allGroupsStandings.push(...sortedGroupStandings);
  }

  allGroupsStandings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.h2hStats && b.h2hStats) {
      if (b.h2hStats.points !== a.h2hStats.points) {
        return b.h2hStats.points - a.h2hStats.points;
      }
      if (b.h2hStats.diff !== a.h2hStats.diff) {
        return b.h2hStats.diff - a.h2hStats.diff;
      }
      if (b.h2hStats.for !== a.h2hStats.for) {
        return b.h2hStats.for - a.h2hStats.for;
      }
    }
    if (b.scoreDifference !== a.scoreDifference)
      return b.scoreDifference - a.scoreDifference;
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
    return a.team.localeCompare(b.team);
  });

  finalStandings.allGroups = allGroupsStandings;

  return finalStandings;
}

export default calculateStandings;
