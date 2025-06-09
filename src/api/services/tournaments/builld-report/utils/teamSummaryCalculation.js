/**
 * Calculates a detailed summary for each team in a category.
 * @param {Array<string>} allTeams - A list of all team names in the category.
 * @param {object} fixtures - The structured fixtures object from ReportBuilder.
 * @param {Array<object>} teamsByGroup - Team groupings by group number.
 * @param {Array<object>} teamsByBracket - Team groupings by bracket name.
 * @returns {Array<object>} - An array of team summary objects.
 */
function calculateTeamSummary(allTeams, fixtures, teamsByGroup, teamsByBracket) {
  const summaryMap = new Map();

  // 1. Initialize summary object for each team
  allTeams.forEach(team => {
    summaryMap.set(team, {
      team: team,
      playingTime: 0,
      matchesPlayed: 0,
      matchesSkipped: 0,
      progression: {
        group: null,
        bracket: null,
      },
      totalScore: {
        for: { goals: 0, points: 0, score: 0 },
        against: { goals: 0, points: 0, score: 0 },
        scoreDifference: 0,
        scoreGainRatePerMinute: 0,
        scoreLossRatePerMinute: 0,
        scoreNetRatePerMinute: 0,
      },
      cards: { yellow: 0, red: 0, black: 0 },
    });
  });

  // 2. Populate progression data
  teamsByGroup.forEach(groupInfo => {
    groupInfo.teams.forEach(teamName => {
      if (summaryMap.has(teamName)) {
        summaryMap.get(teamName).progression.group = groupInfo.group;
      }
    });
  });

  teamsByBracket.forEach(bracketInfo => {
    bracketInfo.teams.forEach(teamName => {
      if (summaryMap.has(teamName)) {
        summaryMap.get(teamName).progression.bracket = bracketInfo.bracket;
      }
    });
  });

  // 3. Iterate through all fixtures to aggregate stats
  const allFixtures = [...fixtures.stage.group, ...fixtures.stage.knockouts];

  allFixtures.forEach(fixture => {
    if (fixture.outcome === 'not played' || !fixture.team1.name || !fixture.team2.name) {
      return;
    }

    const team1Name = fixture.team1.name;
    const team2Name = fixture.team2.name;
    const team1Summary = summaryMap.get(team1Name);
    const team2Summary = summaryMap.get(team2Name);

    if (!team1Summary || !team2Summary) {
      // This might happen for placeholder teams, so we can ignore them.
      return;
    }

    // Handle skipped matches
    if (fixture.outcome === 'skipped') {
      team1Summary.matchesSkipped++;
      team2Summary.matchesSkipped++;
      return; // Do not count towards playing time, matches played, or scores
    }

    // Aggregate match stats
    team1Summary.matchesPlayed++;
    team2Summary.matchesPlayed++;

    const duration = fixture.planned.duration || 0;
    team1Summary.playingTime += duration;
    team2Summary.playingTime += duration;

    // Aggregate scores
    team1Summary.totalScore.for.goals += fixture.team1.goals;
    team1Summary.totalScore.for.points += fixture.team1.points;
    team1Summary.totalScore.against.goals += fixture.team2.goals;
    team1Summary.totalScore.against.points += fixture.team2.points;

    team2Summary.totalScore.for.goals += fixture.team2.goals;
    team2Summary.totalScore.for.points += fixture.team2.points;
    team2Summary.totalScore.against.goals += fixture.team1.goals;
    team2Summary.totalScore.against.points += fixture.team1.points;

    // Aggregate cards
    fixture.cards.forEach(card => {
      if (card.team === team1Name && team1Summary.cards[card.cardColor] !== undefined) {
        team1Summary.cards[card.cardColor]++;
      } else if (card.team === team2Name && team2Summary.cards[card.cardColor] !== undefined) {
        team2Summary.cards[card.cardColor]++;
      }
    });
  });

  // 4. Calculate derived stats
  const summaryArray = [];
  summaryMap.forEach(summary => {
    const scoreFor = (summary.totalScore.for.goals * 3) + summary.totalScore.for.points;
    const scoreAgainst = (summary.totalScore.against.goals * 3) + summary.totalScore.against.points;
    const scoreDifference = scoreFor - scoreAgainst;

    summary.totalScore.for.score = scoreFor;
    summary.totalScore.against.score = scoreAgainst;
    summary.totalScore.scoreDifference = scoreDifference;

    if (summary.playingTime > 0) {
      summary.totalScore.scoreGainRatePerMinute = scoreFor / summary.playingTime;
      summary.totalScore.scoreLossRatePerMinute = scoreAgainst / summary.playingTime;
      summary.totalScore.scoreNetRatePerMinute = scoreDifference / summary.playingTime;
    }

    summaryArray.push(summary);
  });

  // Sort by team name
  summaryArray.sort((a, b) => a.team.localeCompare(b.team));

  return summaryArray;
}

module.exports = {
  calculateTeamSummary,
};
