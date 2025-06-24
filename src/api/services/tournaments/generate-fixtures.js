const { v4: uuidv4 } = require('uuid');

/**
 * Converts a number to its ordinal representation (e.g., 1 -> "1st", 2 -> "2nd").
 * @param {number|string} position - The number to convert.
 * @returns {string} The ordinal string.
 */
function getPositionText(position) {
  if (typeof position !== 'number' && typeof position !== 'string') return '';
  const posNum = parseInt(position, 10);
  if (isNaN(posNum)) return position;

  const lastDigit = posNum % 10;
  const lastTwoDigits = posNum % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${posNum}th`;
  }

  switch (lastDigit) {
    case 1:
      return `${posNum}st`;
    case 2:
      return `${posNum}nd`;
    case 3:
      return `${posNum}rd`;
    default:
      return `${posNum}th`;
  }
}

/**
 * Generates a friendly display name for a calculated team ID.
 * @param {string} teamId - The calculated team ID (e.g., "~sf:1/p:1").
 * @param {string} [competitionCode='M'] - The competition code for match placeholders.
 * @returns {string} The friendly display name.
 */
function getDisplayTeamName(teamId, competitionCode = 'M') {
  if (!teamId || !teamId.startsWith('~')) {
    return teamId;
  }

  const winnerLoser = (pos) => (pos === '1' ? 'WINNER' : 'LOSER');

  const match = teamId.match(/^~([^:/]+)(?::([^/]+))?(?:\/p:(\d+))?$/);
  if (!match) {
    return teamId; // fallback
  }

  const [, type, index, position] = match;

  switch (type.toLowerCase()) {
    case 'rank':
      return `${getPositionText(position)} in GROUPS`;
    case 'best':
      return `${getPositionText(index)} BEST ${getPositionText(position)}-place`;
    case 'match': {
      const matchId = index ? index.slice(-2) : '';
      return `${winnerLoser(position)} of MATCH ${competitionCode}.${matchId}`;
    }
    case 'team':
      return `T.B.D #${index}`;
    case 'group':
      return `${getPositionText(position)} in GROUP ${index}`;
    case 'eights':
    case 'ef':
      return `${winnerLoser(position)} of EIGHTS ${index}`;
    case 'quarters':
    case 'qf':
      return `${winnerLoser(position)} of QUARTERS ${index}`;
    case 'semis':
    case 'sf':
      return `${winnerLoser(position)} of SEMIS ${index}`;
    case 'finals':
    case 'fin':
      return `${winnerLoser(position)} of FINALS`;
    case '3rd4th':
      return `${winnerLoser(position)} of 3/4 PLAY-OFF`;
    case '4th5th':
      return `${winnerLoser(position)} of 4/5 PLAY-OFF`;
    case '5th6th':
      return `${winnerLoser(position)} of 5/6 PLAY-OFF`;
    case '7th8th':
      return `${winnerLoser(position)} of 7/8 PLAY-OFF`;
    case '8th9th':
      return `${winnerLoser(position)} of 8/9 PLAY-OFF`;
    case '9th10th':
      return `${winnerLoser(position)} of 9/10 PLAY-OFF`;
    case '10th11th':
      return `${winnerLoser(position)} of 10/11 PLAY-OFF`;
    case '11th12th':
      return `${winnerLoser(position)} of 11/12 PLAY-OFF`;
    case '12th13th':
      return `${winnerLoser(position)} of 12/13 PLAY-OFF`;
    case '13th14th':
      return `${winnerLoser(position)} of 13/14 PLAY-OFF`;
    case 'bye':
      return 'BYE';
    default:
      return teamId;
  }
}

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
 * @param {string} competitionCode - The code for the competition (e.g., "MSH").
 * @returns {object[]} Array of generated fixture objects.
 */
function generateBracketFixtures(bracket, duration, competitionCode) {
  const { numberOfTeams } = bracket;
  const fixtures = [];

  const createFixture = (stage, team1Id, team2Id) => ({
    id: uuidv4(),
    stage: `${bracket.type}_${stage}`,
    team1Id,
    team2Id,
    team1Display: getDisplayTeamName(team1Id, competitionCode),
    team2Display: getDisplayTeamName(team2Id, competitionCode),
    duration,
  });

  if (numberOfTeams === 3) {
    const teams = ['~team:1', '~team:2', '~team:3'];
    fixtures.push(createFixture('playoffs', teams[0], teams[1]));
    fixtures.push(createFixture('playoffs', teams[1], teams[2]));
    fixtures.push(createFixture('playoffs', teams[2], teams[0]));
    return fixtures;
  }

  if (numberOfTeams === 4) {
    fixtures.push(createFixture('semis', '~team:1', '~team:2'));
    fixtures.push(createFixture('semis', '~team:3', '~team:4'));
    fixtures.push(createFixture('finals', '~semis:1/p:1', '~semis:2/p:1'));
    fixtures.push(createFixture('3rd4th', '~semis:1/p:2', '~semis:2/p:2'));
    return fixtures;
  }

  if (numberOfTeams >= 5 && numberOfTeams <= 8) {
    const teams = Array.from(
      { length: numberOfTeams },
      (_, i) => `~team:${i + 1}`
    );
    const byes = Array.from({ length: 8 - numberOfTeams }, () => `~bye`);
    const participants = [...teams, ...byes].sort(); // Sort to distribute byes in a standard seeding

    // Standard 8-team seeding: 1v8, 4v5, 3v6, 2v7
    fixtures.push(createFixture('quarters', participants[0], participants[7]));
    fixtures.push(createFixture('quarters', participants[3], participants[4]));
    fixtures.push(createFixture('quarters', participants[2], participants[5]));
    fixtures.push(createFixture('quarters', participants[1], participants[6]));

    fixtures.push(createFixture('semis', '~quarters:1/p:1', '~quarters:3/p:1'));
    fixtures.push(createFixture('semis', '~quarters:2/p:1', '~quarters:4/p:1'));

    fixtures.push(createFixture('finals', '~semis:1/p:1', '~semis:2/p:1'));
    fixtures.push(createFixture('3rd4th', '~semis:1/p:2', '~semis:2/p:2'));
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
  const { defaultMatchDuration, code: competitionCode } = competition;

  // Generate preliminary (group) fixtures
  if (competition.preliminaryStage && competition.preliminaryStage.groups) {
    competition.preliminaryStage.groups.forEach((group) => {
      group.fixtures = generateGroupFixtures(
        group.teamIds,
        defaultMatchDuration
      );
    });
  }

  // Generate knockout fixtures
  if (competition.knockoutStage && competition.knockoutStage.brackets) {
    competition.knockoutStage.brackets.forEach((bracket) => {
      bracket.fixtures = generateBracketFixtures(
        bracket,
        defaultMatchDuration,
        competitionCode
      );
    });
  }

  return competition;
}

module.exports = {
  generateFixturesForCompetition,
};
