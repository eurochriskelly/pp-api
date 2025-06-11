const { v4: uuidv4 } = require('uuid');

/**
 * Generates round-robin fixtures for a single group using the circle method (Berger tables).
 * This ensures a more balanced schedule than a simple nested loop.
 * @param {string[]} teamIds - Array of team IDs in the group.
 * @param {number} duration - Match duration.
 * @returns {object[]} Array of generated fixture objects.
 */
function generateGroupFixtures(teamIds, duration) {
  const fixtures = [];
  if (!teamIds || teamIds.length < 2) {
    return fixtures;
  }

  const teams = [...teamIds];
  const BYE = null; // Represents a bye

  // If there's an odd number of teams, add a "bye" team to make it even.
  if (teams.length % 2 !== 0) {
    teams.push(BYE);
  }

  const n = teams.length;
  const numRounds = n - 1;
  const half = n / 2;

  const teamList = [...teams];

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < half; i++) {
      const team1 = teamList[i];
      const team2 = teamList[n - 1 - i];

      // Only create a fixture if neither team is a bye
      if (team1 !== BYE && team2 !== BYE) {
        fixtures.push({
          id: uuidv4(),
          team1Id: team1,
          team2Id: team2,
          duration: duration,
        });
      }
    }

    // Rotate teams for the next round, keeping the first team fixed.
    // The last element moves to the second position, and the others shift down.
    const firstTeam = teamList.shift();
    const lastTeam = teamList.pop();
    teamList.unshift(lastTeam);
    teamList.unshift(firstTeam);
  }

  return fixtures;
}

/**
 * Generates knockout fixtures for a single bracket.
 * @param {object} bracket - The bracket object { numberOfTeams, type }.
 * @param {number} duration - Match duration.
 * @returns {object[]} Array of generated fixture objects.
 */
function generateBracketFixtures(bracket, duration) {
    const { numberOfTeams } = bracket;
    const fixtures = [];

    if (numberOfTeams === 3) {
        const teams = ['~team:1', '~team:2', '~team:3'];
        fixtures.push({ id: uuidv4(), stage: 'P/O', team1Id: teams[0], team2Id: teams[1], duration });
        fixtures.push({ id: uuidv4(), stage: 'P/O', team1Id: teams[1], team2Id: teams[2], duration });
        fixtures.push({ id: uuidv4(), stage: 'P/O', team1Id: teams[2], team2Id: teams[0], duration });
        return fixtures;
    }

    if (numberOfTeams === 4) {
        fixtures.push({ id: uuidv4(), stage: 'SF1', team1Id: '~team:1', team2Id: '~team:2', duration });
        fixtures.push({ id: uuidv4(), stage: 'SF2', team1Id: '~team:3', team2Id: '~team:4', duration });
        fixtures.push({ id: uuidv4(), stage: 'FIN', team1Id: '~sf:1/p:1', team2Id: '~sf:2/p:1', duration });
        fixtures.push({ id: uuidv4(), stage: '3/4', team1Id: '~sf:1/p:2', team2Id: '~sf:2/p:2', duration });
        return fixtures;
    }

    if (numberOfTeams >= 5 && numberOfTeams <= 8) {
        const teams = Array.from({ length: numberOfTeams }, (_, i) => `~team:${i + 1}`);
        const byes = Array.from({ length: 8 - numberOfTeams }, () => `~bye`);
        const participants = [...teams, ...byes].sort(); // Sort to distribute byes in a standard seeding

        // Standard 8-team seeding: 1v8, 4v5, 3v6, 2v7
        fixtures.push({ id: uuidv4(), stage: 'QF1', team1Id: participants[0], team2Id: participants[7], duration });
        fixtures.push({ id: uuidv4(), stage: 'QF2', team1Id: participants[3], team2Id: participants[4], duration });
        fixtures.push({ id: uuidv4(), stage: 'QF3', team1Id: participants[2], team2Id: participants[5], duration });
        fixtures.push({ id: uuidv4(), stage: 'QF4', team1Id: participants[1], team2Id: participants[6], duration });

        fixtures.push({ id: uuidv4(), stage: 'SF1', team1Id: '~qf:1/p:1', team2Id: '~qf:2/p:1', duration });
        fixtures.push({ id: uuidv4(), stage: 'SF2', team1Id: '~qf:3/p:1', team2Id: '~qf:4/p:1', duration });

        fixtures.push({ id: uuidv4(), stage: 'FIN', team1Id: '~sf:1/p:1', team2Id: '~sf:2/p:1', duration });
        fixtures.push({ id: uuidv4(), stage: '3/4', team1Id: '~sf:1/p:2', team2Id: '~sf:2/p:2', duration });
        return fixtures;
    }
    
    return fixtures;
}


/**
 * Generates fixtures for a given competition structure.
 * @param {object} competition - The competition object.
 * @returns {object} The competition object hydrated with fixtures.
 */
function generateFixturesForCompetition(competition) {
  const { defaultMatchDuration } = competition;

  // Generate preliminary (group) fixtures
  if (competition.preliminaryStage && competition.preliminaryStage.groups) {
    competition.preliminaryStage.groups.forEach(group => {
      group.fixtures = generateGroupFixtures(group.teamIds, defaultMatchDuration);
    });
  }

  // Generate knockout fixtures
  if (competition.knockoutStage && competition.knockoutStage.brackets) {
    competition.knockoutStage.brackets.forEach(bracket => {
      bracket.fixtures = generateBracketFixtures(bracket, defaultMatchDuration);
    });
  }

  return competition;
}

module.exports = {
  generateFixturesForCompetition,
};
