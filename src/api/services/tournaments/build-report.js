module.exports = {
  buildReport
}

async function buildReport(
  tournamentId,
  select
) {
  const tournament = await getTournamentInfo(tournamentId, select);
  const pitches = await getPitchInfo(tournamentId, select);
  const categoryTeams = await getCategoriesInfo(tournamentId, select);
  return {
    tournamentId,
    tournament,
    pitches,
    categories: {
      teams: categoryTeams,
      fixtures: []
    },
  }
}

async function getCategoriesInfo(tournamentId, select) {
  // Fetch distinct category names first
  const categoryRows = await select(`SELECT DISTINCT category FROM fixtures WHERE tournamentId=? ORDER BY category`, [tournamentId]);

  // Process each category to get the desired structure
  const categoryPromises = categoryRows.map(async (catRow) => {
    const category = catRow.category;

    // 1. Get all unique teams for the category
    const allTeamsResult = await select(`
      SELECT DISTINCT team FROM (
        SELECT team1Id as team FROM fixtures 
        WHERE tournamentId=? AND category=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
        UNION 
        SELECT team2Id as team FROM fixtures 
        WHERE tournamentId=? AND category=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
      ) AS combined_teams ORDER BY team
    `, [tournamentId, category, tournamentId, category]);
    const allTeams = allTeamsResult.map(t => t.team);

    // 2. Get distinct group numbers for the category where stage is 'group'
    const groupNumberRows = await select(`
      SELECT DISTINCT groupNumber FROM fixtures 
      WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber IS NOT NULL 
      ORDER BY groupNumber
    `, [tournamentId, category]);

    // 3. For each group number, get the teams in that specific group
    const groupPromises = groupNumberRows.map(async (groupRow) => {
      const groupNumber = groupRow.groupNumber;
      const groupTeamsResult = await select(`
        SELECT DISTINCT team FROM (
          SELECT team1Id as team FROM fixtures 
          WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
          UNION 
          SELECT team2Id as team FROM fixtures 
          WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
        ) AS group_teams ORDER BY team
      `, [tournamentId, category, groupNumber, tournamentId, category, groupNumber]);
      
      return {
        group: groupNumber,
        teams: groupTeamsResult.map(t => t.team)
      };
    });

    const byGroup = await Promise.all(groupPromises);

    // 4. Assemble the final object for the category
    return {
      category: category,
      allTeams: allTeams,
      byGroup: byGroup
    };
  });

  // Wait for all category processing promises to resolve
  return Promise.all(categoryPromises);
}

async function getPitchInfo(tournamentId, select) {
  return await select(`select id, pitch, location from pitches where tournamentId=${tournamentId}`);
}

async function getTournamentInfo(tournamentId, select) {
  let res = (await select(`SELECT 
     Date as startDate, endDate, Title, Location,
     region, season, Lat, Lon, eventUuid, status,
     pointsForWin, pointsForDraw, pointsForLoss
     FROM tournaments where id=${tournamentId}`)
  ).shift();
  return {
    eventUuid: res.eventUuid,
    status: res.status,
    date: res.startDate, 
    title: res.Title,
    location: {
      address: res.Location,
      lat: res.Lat,
      lon: res.Lon,
    },
    pointsFor: {
      win: res.pointsForWin,
      draw: res.pointsForDraw,
      loss: res.pointsForLoss,
    }
  }  
}
