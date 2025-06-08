/**
 * Exporter for CSV format
 */
class CsvExporter {
  export(reportData) {
    // Create arrays to hold our CSV data
    const tournamentInfo = this.formatTournamentInfo(reportData.tournament);
    const fixtureRows = this.formatFixtures(reportData.categories);
    const standingsRows = this.formatStandings(reportData.categories);
    
    // Combine all data
    return {
      tournamentInfo,
      fixtures: fixtureRows,
      standings: standingsRows,
    };
  }

  formatTournamentInfo(tournament) {
    if (!tournament) return [];
    
    return [
      ['Tournament Information'],
      ['Title', tournament.title],
      ['Date', tournament.date],
      ['Season', tournament.season],
      ['Location', tournament.location.address],
      ['Region', tournament.location.region],
      ['Status', tournament.status],
      ['Points for Win', tournament.pointsFor.win],
      ['Points for Draw', tournament.pointsFor.draw],
      ['Points for Loss', tournament.pointsFor.loss]
    ];
  }

  formatFixtures(categories) {
    if (!categories || categories.length === 0) return [];
    
    // Create headers
    const headers = [
      'Category', 'Stage', 'Pool/Bracket', 'Match ID', 
      'Team 1', 'Team 1 Score', 'Team 2', 'Team 2 Score',
      'Scheduled Time', 'Pitch', 'Status'
    ];
    
    const rows = [headers];
    
    // Process each category
    categories.forEach(category => {
      const catName = category.category;
      
      // Process group fixtures
      if (category.fixtures && category.fixtures.stage && category.fixtures.stage.group) {
        category.fixtures.stage.group.forEach(fixture => {
          rows.push(this.formatFixtureRow(catName, 'Group', fixture));
        });
      }
      
      // Process knockout fixtures
      if (category.fixtures && category.fixtures.stage && category.fixtures.stage.knockouts) {
        category.fixtures.stage.knockouts.forEach(fixture => {
          rows.push(this.formatFixtureRow(catName, 'Knockout', fixture));
        });
      }
    });
    
    return rows;
  }
  
  formatFixtureRow(category, stageType, fixture) {
    const team1Score = fixture.team1.goals !== null ? 
      `${fixture.team1.goals}-${fixture.team1.points}` : '';
    const team2Score = fixture.team2.goals !== null ? 
      `${fixture.team2.goals}-${fixture.team2.points}` : '';
    
    return [
      category,
      fixture.stage || stageType,
      stageType === 'Group' ? fixture.pool : fixture.bracket,
      fixture.matchId,
      fixture.team1.name,
      team1Score,
      fixture.team2.name,
      team2Score,
      fixture.actual.scheduled || fixture.planned.scheduled,
      fixture.actual.pitch || fixture.planned.pitch,
      fixture.outcome
    ];
  }

  formatStandings(categories) {
    if (!categories || categories.length === 0) return [];

    const allStandingsRows = [];

    categories.forEach(category => {
      if (!category.standings) return;

      allStandingsRows.push([`Standings for ${category.category}`]);

      // Process byGroup standings
      if (category.standings.byGroup) {
        const groupKeys = Object.keys(category.standings.byGroup);
        
        const sortedGroupKeys = groupKeys
          .filter(key => key.startsWith('GP.'))
          .sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)));

        sortedGroupKeys.forEach(groupName => {
          const standings = category.standings.byGroup[groupName];
          if (!standings || standings.length === 0) return;

          allStandingsRows.push([]); // Blank line for spacing
          const title = `Group: ${groupName}`;
          allStandingsRows.push([title]);
          
          const headers = ['Rank', 'Team', 'Played', 'Won', 'Draw', 'Loss', 'Score For', 'Score Against', 'Score Diff', 'Points'];
          allStandingsRows.push(headers);

          standings.forEach((team, index) => {
            const row = [
              index + 1,
              team.team,
              team.matchesPlayed,
              team.won,
              team.draw,
              team.loss,
              team.scoreFor,
              team.scoreAgainst,
              team.scoreDifference,
              team.points
            ];
            allStandingsRows.push(row);
          });
        });
      }

      // Process allGroups standings
      if (category.standings.allGroups && category.standings.allGroups.length > 0) {
        const standings = category.standings.allGroups;
        
        allStandingsRows.push([]); // Blank line for spacing
        const title = 'Overall Group Standings';
        allStandingsRows.push([title]);
        
        const headers = ['Rank', 'Team', 'Played', 'Won', 'Draw', 'Loss', 'Score For', 'Score Against', 'Score Diff', 'Points'];
        allStandingsRows.push(headers);

        standings.forEach((team, index) => {
          const row = [
            index + 1,
            team.team,
            team.matchesPlayed,
            team.won,
            team.draw,
            team.loss,
            team.scoreFor,
            team.scoreAgainst,
            team.scoreDifference,
            team.points
          ];
          allStandingsRows.push(row);
        });
      }
    });

    return allStandingsRows;
  }
}

module.exports = { CsvExporter };
