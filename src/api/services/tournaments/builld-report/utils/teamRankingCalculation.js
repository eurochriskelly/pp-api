const BRACKET_ORDER = ['Cup', 'Shield', 'Plate', 'Bowl', 'Spoon'];
const PLAYOFF_STAGE_ORDER = [
  'FIN', '3/4', '4/5', '5/6', '6/7', '7/8', '8/9', '9/10', 
  '10/11', '11/12', '12/13', '13/14'
];

/**
 * Calculates the overall tournament rank for each team.
 * @param {object} fixtures - The structured fixtures object from ReportBuilder.
 * @param {Array<object>} teamsByBracket - Team groupings by bracket name.
 * @param {Array<object>} allGroupsStandings - The sorted overall group standings.
 * @returns {Map<string, number>} - A map of team name to its rank.
 */
function calculateTeamRankings(fixtures, teamsByBracket, allGroupsStandings) {
  const teamRanks = new Map();
  const rankedTeams = new Set();
  let rankCounter = 1;

  const allKnockoutFixtures = fixtures.stage.knockouts;
  const teamsByBracketMap = new Map(teamsByBracket.map(b => [b.bracket, b.teams]));

  // Step 1: Rank teams from bracket play-off matches.
  BRACKET_ORDER.forEach(bracketName => {
    if (!teamsByBracketMap.has(bracketName)) return;

    PLAYOFF_STAGE_ORDER.forEach(stageCode => {
      const fixture = allKnockoutFixtures.find(f => f.bracket === bracketName && f.stage === stageCode);

      if (fixture && fixture.outcome !== 'not played' && fixture.outcome !== 'skipped') {
        const team1 = fixture.team1;
        const team2 = fixture.team2;

        if (team1.name && !rankedTeams.has(team1.name) && team2.name && !rankedTeams.has(team2.name)) {
          if (fixture.team1.status === 'draw') {
            teamRanks.set(team1.name, rankCounter);
            teamRanks.set(team2.name, rankCounter);
          } else {
            const winner = fixture.team1.status === 'won' ? team1.name : team2.name;
            const loser = fixture.team1.status === 'won' ? team2.name : team1.name;
            teamRanks.set(winner, rankCounter);
            teamRanks.set(loser, rankCounter + 1);
          }
          rankedTeams.add(team1.name);
          rankedTeams.add(team2.name);
          rankCounter += 2;
        }
      }
    });
  });

  // Step 2: Rank remaining teams in brackets based on group performance.
  const groupStandingsRankMap = new Map(allGroupsStandings.map((s, i) => [s.team, i + 1]));

  BRACKET_ORDER.forEach(bracketName => {
    if (!teamsByBracketMap.has(bracketName)) return;

    const bracketTeams = teamsByBracketMap.get(bracketName);
    const unrankedInBracket = bracketTeams
      .filter(team => !rankedTeams.has(team))
      .sort((a, b) => (groupStandingsRankMap.get(a) || Infinity) - (groupStandingsRankMap.get(b) || Infinity));

    unrankedInBracket.forEach(team => {
      if (!rankedTeams.has(team)) {
        teamRanks.set(team, rankCounter);
        rankedTeams.add(team);
        rankCounter++;
      }
    });
  });

  // Step 3: Rank "None" bracket teams.
  if (teamsByBracketMap.has('None')) {
    const noneBracketTeams = teamsByBracketMap.get('None')
      .sort((a, b) => (groupStandingsRankMap.get(a) || Infinity) - (groupStandingsRankMap.get(b) || Infinity));

    noneBracketTeams.forEach(team => {
      if (!rankedTeams.has(team)) {
        teamRanks.set(team, rankCounter);
        rankedTeams.add(team);
        rankCounter++;
      }
    });
  }

  return teamRanks;
}

module.exports = {
  calculateTeamRankings,
};
