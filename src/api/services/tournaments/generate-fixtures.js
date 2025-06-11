const { v4: uuidv4 } = require('uuid');

/**
 * Generates round-robin fixtures for a single group.
 * @param {string[]} teamIds - Array of team IDs in the group.
 * @param {number} duration - Match duration.
 * @returns {object[]} Array of generated fixture objects.
 */
function generateGroupFixtures(teamIds, duration) {
  const fixtures = [];
  if (!teamIds || teamIds.length < 2) {
    return fixtures;
  }

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      fixtures.push({
        id: uuidv4(),
        team1Id: teamIds[i],
        team2Id: teamIds[j],
        duration: duration,
      });
    }
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
