const { BRACKET_ORDER, PLAYOFF_STAGE_ORDER } = require('./rankingConstants');

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
  const groupStandingsRankMap = new Map(
    allGroupsStandings.map((s, i) => [s.team, i])
  );

  // Build team→group lookup for O(1) access
  const teamToGroupMap = new Map();
  teamsByGroup.forEach((g) => {
    g.teams.forEach((team) => {
      teamToGroupMap.set(team, `GP.${g.group}`);
    });
  });

  // Helper to get a team's group
  function getTeamGroup(teamName) {
    return teamToGroupMap.get(teamName) || null;
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
    // Step 1: Process each bracket completely before moving to next bracket
    // This ensures ALL Cup teams rank above ALL Shield teams, etc.
    BRACKET_ORDER.forEach((bracketName) => {
      if (!teamsByBracketMap.has(bracketName)) return;

      const bracketFixtures = allKnockoutFixtures.filter(
        (f) => f.bracket === bracketName
      );

      // Get all teams in this bracket that played in knockouts
      const bracketTeams = new Set();
      bracketFixtures.forEach((f) => {
        if (f.team1.name) bracketTeams.add(f.team1.name);
        if (f.team2.name) bracketTeams.add(f.team2.name);
      });

      // Process finals and playoffs in order for this bracket
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

      // Step 2: Rank remaining teams in this bracket (eliminated early, no playoff)
      // Get teams that played in knockouts but weren't ranked yet
      const unrankedInBracket = Array.from(bracketTeams)
        .filter((team) => !rankedTeams.has(team))
        .sort(compareTeamsForRanking);

      unrankedInBracket.forEach((team) => {
        // Find the last knockout match this team played
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
