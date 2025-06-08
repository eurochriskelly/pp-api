/**
 * Calculates group standings from fixture data.
 * @param {object} fixtures - The structured fixtures object from ReportBuilder.
 * @param {Array} teamsByGroup - Array of objects, each with group number and list of teams.
 * @param {object} pointsConfig - Contains points for win, draw, and loss.
 * @returns {object} - An object containing standings grouped by pool.
 */
function calculateStandings(fixtures, teamsByGroup, pointsConfig) {
  const { win, draw, loss } = pointsConfig;
  const groupFixtures = fixtures.stage.group;

  const standingsByGroup = {};

  // Initialize standings for all teams in each group to include teams that haven't played.
  teamsByGroup.forEach(group => {
    const groupName = `GP.${group.group}`;
    standingsByGroup[groupName] = {};
    group.teams.forEach(team => {
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

  // Process each group fixture to calculate results
  groupFixtures.forEach(fixture => {
    if (fixture.outcome === 'not played' || !fixture.team1.name || !fixture.team2.name) {
      return; // Skip unplayed or placeholder fixtures
    }

    const groupName = `GP.${fixture.pool}`;
    if (!standingsByGroup[groupName]) {
      standingsByGroup[groupName] = {};
    }

    const team1Name = fixture.team1.name;
    const team2Name = fixture.team2.name;

    // Ensure team entries exist
    if (!standingsByGroup[groupName][team1Name]) {
        standingsByGroup[groupName][team1Name] = { team: team1Name, matchesPlayed: 0, won: 0, draw: 0, loss: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0 };
    }
    if (!standingsByGroup[groupName][team2Name]) {
        standingsByGroup[groupName][team2Name] = { team: team2Name, matchesPlayed: 0, won: 0, draw: 0, loss: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0 };
    }

    const team1Stats = standingsByGroup[groupName][team1Name];
    const team2Stats = standingsByGroup[groupName][team2Name];

    team1Stats.matchesPlayed++;
    team2Stats.matchesPlayed++;

    team1Stats.scoreFor += fixture.team1.total;
    team1Stats.scoreAgainst += fixture.team2.total;
    team2Stats.scoreFor += fixture.team2.total;
    team2Stats.scoreAgainst += fixture.team1.total;

    if (fixture.team1.status === 'won') {
      team1Stats.won++;
      team1Stats.points += win;
      team2Stats.loss++;
      team2Stats.points += loss;
    } else if (fixture.team1.status === 'lost') {
      team1Stats.loss++;
      team1Stats.points += loss;
      team2Stats.won++;
      team2Stats.points += win;
    } else if (fixture.team1.status === 'draw') {
      team1Stats.draw++;
      team1Stats.points += draw;
      team2Stats.draw++;
      team2Stats.points += draw;
    }
  });

  const finalStandings = { byGroup: {} };
  let allGroupsStandings = [];

  // Convert map to sorted array for each group and calculate final stats
  for (const groupName in standingsByGroup) {
    const groupStandings = Object.values(standingsByGroup[groupName]);
    
    groupStandings.forEach(s => {
      s.scoreDifference = s.scoreFor - s.scoreAgainst;
    });

    // Sort standings: 1. points, 2. scoreDifference, 3. scoreFor
    groupStandings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDifference !== a.scoreDifference) return b.scoreDifference - a.scoreDifference;
      if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
      return a.team.localeCompare(b.team);
    });

    finalStandings.byGroup[groupName] = groupStandings;
    allGroupsStandings.push(...groupStandings);
  }

  // Sort allGroups standings by the same criteria
  allGroupsStandings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.scoreDifference !== a.scoreDifference) return b.scoreDifference - a.scoreDifference;
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
    return a.team.localeCompare(b.team);
  });

  finalStandings.byGroup.allGroups = allGroupsStandings;

  return finalStandings;
}

module.exports = {
  calculateStandings,
};
