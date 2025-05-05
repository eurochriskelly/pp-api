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
  let res = await select(`select distinct category from fixtures where tournamentId=${tournamentId}`);
  return res.map(async category => {
    const teams = await select(`
      (
        select distinct team1Id as team from fixtures 
        where tournamentId=${tournamentId} and team1Id is not like '~%' and category='${category}'
      ) UNION (
        select distinc team2Id as team from fixtures 
        where tournamentId=${tournamentId} and team1Id is not like '~%' and category='${category}'
      )
    `)
    console.log('teams', teams)
  })
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
