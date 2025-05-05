module.exports = {
  buildReport
}

async function buildReport(
  tournamentId,
  select
) {
  const tournament = await getTournamentInfo(tournamentId, select);
  const pitches = await getPitchInfo(tournamentId, select);
  const categories = await getCategoriesInfo(tournamentId, select);
  return {
    tournamentId,
    // tournament,
    // pitches,
    categories,
  }
}

async function getCategoriesInfo(tournamentId, select) {
  // Fetch distinct category names first
  let categoryRows = await select(`select distinct category from fixtures where tournamentId=?`, [tournamentId]);
  
  // Map over category names and fetch teams for each, returning promises
  const categoryPromises = categoryRows.map(async (catRow) => {
    const category = catRow.category; // Extract category name
    const teams = await select(`
      SELECT DISTINCT team FROM (
        SELECT team1Id as team FROM fixtures 
        WHERE tournamentId=? AND category=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
        UNION 
        SELECT team2Id as team FROM fixtures 
        WHERE tournamentId=? AND category=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
      ) AS combined_teams
    `, [tournamentId, category, tournamentId, category]);
    
    // Return an object containing the category and its teams
    return {
      category: category,
      teams: teams.map(t => t.team) // Extract just the team names/IDs
    };
  });

  // Wait for all promises to resolve
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
