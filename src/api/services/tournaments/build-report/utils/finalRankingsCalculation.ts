import { BRACKET_ORDER, PLAYOFF_STAGE_ORDER } from './rankingConstants';

export interface FinalRankingInput {
  fixtures: {
    stage: {
      knockouts: Array<{
        bracket: string;
        stage: string;
        outcome: string;
        team1: { name: string; status: string };
        team2: { name: string; status: string };
      }>;
    };
  };
  teamsByBracket: Array<{ bracket: string; teams: string[] }>;
  teamsByGroup: Array<{ group: number; teams: string[] }>;
  allGroupsStandings: Array<{
    team: string;
    points: number;
    scoreDifference: number;
    scoreFor: number;
  }>;
}

export interface RankingEntry {
  position: number;
  teamName: string;
  bracket: string;
  group: string | null;
  lastKnockoutMatch: {
    stage: string;
    bracket: string;
    opponent: string;
    result: string;
  } | null;
}

/**
 * Calculates the final tournament rankings for all teams.
 */
export function calculateFinalRankings(
  fixtures: FinalRankingInput['fixtures'],
  teamsByBracket: FinalRankingInput['teamsByBracket'],
  teamsByGroup: FinalRankingInput['teamsByGroup'],
  allGroupsStandings: FinalRankingInput['allGroupsStandings']
): RankingEntry[] {
  const rankings: RankingEntry[] = [];
  const rankedTeams = new Set<string>();
  let currentPosition = 1;

  const allKnockoutFixtures = fixtures.stage.knockouts;
  const hasKnockouts = allKnockoutFixtures && allKnockoutFixtures.length > 0;

  const teamsByBracketMap = new Map(
    teamsByBracket.map((b) => [b.bracket, b.teams])
  );
  const groupStandingsRankMap = new Map(
    allGroupsStandings.map((s, i) => [s.team, i])
  );

  const teamToGroupMap = new Map<string, string>();
  teamsByGroup.forEach((g) => {
    g.teams.forEach((team) => {
      teamToGroupMap.set(team, `GP.${g.group}`);
    });
  });

  function getTeamGroup(teamName: string): string | null {
    return teamToGroupMap.get(teamName) || null;
  }

  function getGroupPositionRank(teamName: string): number {
    return groupStandingsRankMap.get(teamName) ?? Infinity;
  }

  function compareTeamsForRanking(teamA: string, teamB: string): number {
    return getGroupPositionRank(teamA) - getGroupPositionRank(teamB);
  }

  function createRankingEntry(
    teamName: string,
    bracket: string,
    lastMatch: RankingEntry['lastKnockoutMatch']
  ): RankingEntry {
    return {
      position: currentPosition++,
      teamName,
      bracket,
      group: getTeamGroup(teamName),
      lastKnockoutMatch: lastMatch,
    };
  }

  function getWinnerLoser(
    fixture: FinalRankingInput['fixtures']['stage']['knockouts'][0]
  ): {
    winner: string;
    loser: string;
  } {
    if (fixture.team1.status === 'won') {
      return { winner: fixture.team1.name, loser: fixture.team2.name };
    } else if (fixture.team2.status === 'won') {
      return { winner: fixture.team2.name, loser: fixture.team1.name };
    }
    const team1Rank = getGroupPositionRank(fixture.team1.name);
    const team2Rank = getGroupPositionRank(fixture.team2.name);
    if (team1Rank < team2Rank) {
      return { winner: fixture.team1.name, loser: fixture.team2.name };
    } else {
      return { winner: fixture.team2.name, loser: fixture.team1.name };
    }
  }

  function createLastMatchInfo(
    fixture: FinalRankingInput['fixtures']['stage']['knockouts'][0],
    teamName: string
  ): RankingEntry['lastKnockoutMatch'] {
    const opponent =
      fixture.team1.name === teamName ? fixture.team2.name : fixture.team1.name;
    const teamSide = fixture.team1.name === teamName ? 'team1' : 'team2';
    const result = (fixture as any)[teamSide].status;

    return {
      stage: fixture.stage,
      bracket: fixture.bracket,
      opponent,
      result,
    };
  }

  if (hasKnockouts) {
    BRACKET_ORDER.forEach((bracketName) => {
      if (!teamsByBracketMap.has(bracketName)) return;

      const bracketFixtures = allKnockoutFixtures.filter(
        (f) => f.bracket === bracketName
      );

      const bracketTeams = new Set<string>();
      bracketFixtures.forEach((f) => {
        if (f.team1.name) bracketTeams.add(f.team1.name);
        if (f.team2.name) bracketTeams.add(f.team2.name);
      });

      PLAYOFF_STAGE_ORDER.forEach((stageCode) => {
        const fixture = bracketFixtures.find((f) => f.stage === stageCode);

        if (
          !fixture ||
          fixture.outcome === 'not played' ||
          fixture.outcome === 'skipped' ||
          !fixture.team1.name ||
          !fixture.team2.name
        ) {
          return;
        }

        const { winner, loser } = getWinnerLoser(fixture);

        if (!rankedTeams.has(winner) && !rankedTeams.has(loser)) {
          rankings.push(
            createRankingEntry(
              winner,
              bracketName,
              createLastMatchInfo(fixture, winner)
            )
          );
          rankedTeams.add(winner);

          rankings.push(
            createRankingEntry(
              loser,
              bracketName,
              createLastMatchInfo(fixture, loser)
            )
          );
          rankedTeams.add(loser);
        }
      });

      const unrankedInBracket = Array.from(bracketTeams)
        .filter((team) => !rankedTeams.has(team))
        .sort(compareTeamsForRanking);

      unrankedInBracket.forEach((team) => {
        const lastMatch = bracketFixtures
          .filter(
            (f) =>
              (f.team1.name === team || f.team2.name === team) &&
              f.outcome !== 'not played' &&
              f.outcome !== 'skipped'
          )
          .pop();

        rankings.push(
          createRankingEntry(
            team,
            bracketName,
            lastMatch ? createLastMatchInfo(lastMatch, team) : null
          )
        );
        rankedTeams.add(team);
      });
    });

    if (teamsByBracketMap.has('None')) {
      const noneBracketTeams = teamsByBracketMap
        .get('None')!
        .filter((team) => !rankedTeams.has(team))
        .sort(compareTeamsForRanking);

      noneBracketTeams.forEach((team) => {
        rankings.push(createRankingEntry(team, 'None', null));
        rankedTeams.add(team);
      });
    }
  } else {
    const sortedTeams = [...allGroupsStandings].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (b.scoreDifference !== a.scoreDifference)
        return b.scoreDifference - a.scoreDifference;
      if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
      return a.team.localeCompare(b.team);
    });

    sortedTeams.forEach((standing) => {
      if (!rankedTeams.has(standing.team)) {
        rankings.push(createRankingEntry(standing.team, 'None', null));
        rankedTeams.add(standing.team);
      }
    });
  }

  return rankings;
}

export default calculateFinalRankings;
