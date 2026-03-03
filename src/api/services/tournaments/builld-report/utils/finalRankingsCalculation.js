const BRACKET_ORDER = ['Cup', 'Shield', 'Plate', 'Bowl', 'Spoon'];
const PLAYOFF_STAGE_ORDER = [
  'FIN',
  '3/4',
  '4/5',
  '5/6',
  '6/7',
  '7/8',
  '8/9',
  '9/10',
  '10/11',
  '11/12',
  '12/13',
  '13/14',
];

/**
 * Calculates the final tournament rankings for all teams.
 * Rankings are strictly sequential (1, 2, 3, etc.) with no ties.
 * @param {object} fixtures - The structured fixtures object from ReportBuilder.
 * @param {Array<object>} teamsByBracket - Team groupings by bracket name.
 * @param {Array<object>} teamsByGroup - Team groupings by group number.
 * @param {Array<object>} allGroupsStandings - The sorted overall group standings.
 * @returns {Array<object>} - Array of ranking objects sorted by position.
 */
function calculateFinalRankings(
  fixtures,
  teamsByBracket,
  teamsByGroup,
  allGroupsStandings
) {
  const rankings = [];
  const rankedTeams = new Set();
  let currentPosition = 1;

  const allKnockoutFixtures = fixtures.stage.knockouts;
  const hasKnockouts = allKnockoutFixtures && allKnockoutFixtures.length > 0;

  // Create lookup maps
  const teamsByBracketMap = new Map(
    teamsByBracket.map((b) => [b.bracket, b.teams])
  );
  const teamsByGroupMap = new Map(teamsByGroup.map((g) => [g.group, g.teams]));
  const groupStandingsRankMap = new Map(
    allGroupsStandings.map((s, i) => [s.team, i])
  );

  // Helper to get a team's group
  function getTeamGroup(teamName) {
    for (const [groupNum, teams] of teamsByGroupMap.entries()) {
      if (teams.includes(teamName)) {
        return `GP.${groupNum}`;
      }
    }
    return null;
  }

  // Helper to get group position for tie-breaking
  function getGroupPositionRank(teamName) {
    return groupStandingsRankMap.get(teamName) ?? Infinity;
  }

  // Helper to compare two teams for ordering (returns negative if a should come before b)
  function compareTeamsForRanking(teamA, teamB) {
    return getGroupPositionRank(teamA) - getGroupPositionRank(teamB);
  }

  // Helper to create a ranking entry
  function createRankingEntry(teamName, bracket, lastMatch = null) {
    return {
      position: currentPosition++,
      teamName,
      bracket,
      group: getTeamGroup(teamName),
      lastKnockoutMatch: lastMatch,
    };
  }

  // Helper to determine winner/loser of a fixture
  function getWinnerLoser(fixture) {
    if (fixture.team1.status === 'won') {
      return { winner: fixture.team1.name, loser: fixture.team2.name };
    } else if (fixture.team2.status === 'won') {
      return { winner: fixture.team2.name, loser: fixture.team1.name };
    }
    // Draw - fall back to group position
    const team1Rank = getGroupPositionRank(fixture.team1.name);
    const team2Rank = getGroupPositionRank(fixture.team2.name);
    if (team1Rank < team2Rank) {
      return { winner: fixture.team1.name, loser: fixture.team2.name };
    } else {
      return { winner: fixture.team2.name, loser: fixture.team1.name };
    }
  }

  // Helper to create last match info
  function createLastMatchInfo(fixture, teamName) {
    const opponent =
      fixture.team1.name === teamName ? fixture.team2.name : fixture.team1.name;
    const teamSide = fixture.team1.name === teamName ? 'team1' : 'team2';
    const result = fixture[teamSide].status;

    return {
      stage: fixture.stage,
      bracket: fixture.bracket,
      opponent,
      result,
    };
  }

  if (hasKnockouts) {
    // Process knockout-based rankings
    // Step 1: Process finals and playoffs in order
    BRACKET_ORDER.forEach((bracketName) => {
      if (!teamsByBracketMap.has(bracketName)) return;

      PLAYOFF_STAGE_ORDER.forEach((stageCode) => {
        const fixture = allKnockoutFixtures.find(
          (f) => f.bracket === bracketName && f.stage === stageCode
        );

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

        // Only rank teams that haven't been ranked yet
        if (!rankedTeams.has(winner) && !rankedTeams.has(loser)) {
          // Winner gets current position
          rankings.push(
            createRankingEntry(
              winner,
              bracketName,
              createLastMatchInfo(fixture, winner)
            )
          );
          rankedTeams.add(winner);

          // Loser gets next position
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
    });

    // Step 2: Rank remaining teams in brackets based on group performance
    BRACKET_ORDER.forEach((bracketName) => {
      if (!teamsByBracketMap.has(bracketName)) return;

      const bracketTeams = teamsByBracketMap.get(bracketName);
      const unrankedInBracket = bracketTeams
        .filter((team) => !rankedTeams.has(team))
        .sort(compareTeamsForRanking);

      unrankedInBracket.forEach((team) => {
        if (!rankedTeams.has(team)) {
          // Find the last knockout match this team played
          const lastMatch = allKnockoutFixtures
            .filter(
              (f) =>
                f.bracket === bracketName &&
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
        }
      });
    });

    // Step 3: Rank "None" bracket teams (no knockouts)
    if (teamsByBracketMap.has('None')) {
      const noneBracketTeams = teamsByBracketMap
        .get('None')
        .filter((team) => !rankedTeams.has(team))
        .sort(compareTeamsForRanking);

      noneBracketTeams.forEach((team) => {
        rankings.push(createRankingEntry(team, 'None', null));
        rankedTeams.add(team);
      });
    }
  } else {
    // No knockouts - use group stage standings directly
    // Sort all teams by their group position
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

module.exports = {
  calculateFinalRankings,
};
