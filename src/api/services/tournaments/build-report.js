module.exports = {
  buildReport
}

async function buildReport(
  tournamentId,
  select
) {
  const tournament = await getTournamentInfo(tournamentId, select);
  const pitches = await getPitchInfo(tournamentId, select);
  // Get the basic category info (teams, groups)
  const categoryTeamInfo = await getCategoriesInfo(tournamentId, select); 

  // Now, for each category, fetch and structure its fixtures
  const categoriesWithFixtures = await Promise.all(
    categoryTeamInfo.map(async (catInfo) => {
      const fixtures = await getFixturesForCategory(tournamentId, catInfo.category, select);
      return {
        category: catInfo.category,
        teams: { // Keep the teams structure from getCategoriesInfo
          allTeams: catInfo.allTeams,
          byGroup: catInfo.byGroup,
        },
        fixtures: fixtures, // Add the structured fixtures
      };
    })
  );

  return {
    tournamentId,
    tournament,
    pitches,
    categories: categoriesWithFixtures, // Use the combined data
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

async function getFixturesForCategory(tournamentId, category, select) {
  const fixturesData = await select(`
    SELECT 
      id, tournamentId, category, groupNumber, stage, 
      pitchPlanned, pitch, 
      scheduledPlanned, scheduled, started, ended, 
      team1Planned, team1Id as team1, team2Planned, team2Id as team2, 
      goals1, points1, goals1Extra, points1Extra, goals1Penalties, 
      goals2, points2, goals2Extra, points2Extra, goals2Penalties, 
      umpireTeamPlanned, umpireTeamId, 
      outcome, 
      created, updated 
    FROM fixtures 
    WHERE tournamentId = ? AND category = ?
    ORDER BY stage, groupNumber, scheduledPlanned, id
  `, [tournamentId, category]);

  console.log('xxx yyy', fixturesData);

  let lastUpdated = null;
  const groupFixtures = [];
  const knockoutFixtures = [];

  fixturesData.forEach(f => {
    // Update lastUpdated
    if (!lastUpdated || (f.updated && new Date(f.updated) > new Date(lastUpdated))) {
      lastUpdated = f.updated;
    }

    const transformedFixture = {
      matchId: f.id,
      pool: f.stage === 'group' ? f.groupNumber : null, // Use groupNumber for pool in group stage
      planned: {
        team1: f.team1Planned,
        team2: f.team2Planned,
        scheduled: f.scheduledPlanned,
        pitch: f.pitchPlanned,
      },
      actual: {
        scheduled: f.scheduled,
        pitch: f.pitch,
        started: f.started,
        ended: f.ended,
      },
      team1: {
        name: f.team1, // Assuming team1Id holds the name/identifier
        goals: f.goals1,
        points: f.points1,
        goalsExtra: f.goals1Extra,
        pointsExtra: f.points1Extra,
        goalsPenalties: f.goals1Penalties,
      },
      team2: {
        name: f.team2, // Assuming team2Id holds the name/identifier
        goals: f.goals2,
        points: f.points2,
        goalsExtra: f.goals2Extra,
        pointsExtra: f.points2Extra,
        goalsPenalties: f.goals2Penalties,
      },
      umpireTeam: f.umpireTeamId, // Assuming umpireTeamId holds the name/identifier
      outcome: f.outcome, // Include outcome if needed
    };

    if (f.stage === 'group') {
      groupFixtures.push(transformedFixture);
    } else {
      // Assuming anything not 'group' is 'knockout' for this structure
      knockoutFixtures.push(transformedFixture);
    }
  });

  return {
    lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    totals: {
      group: groupFixtures.length,
      knockouts: knockoutFixtures.length,
    },
    stage: {
      group: groupFixtures,
      knockouts: knockoutFixtures,
    },
  };
}


async function getPitchInfo(tournamentId, select) {
  // Use parameterized query for security
  return await select(`select id, pitch, location from pitches where tournamentId=?`, [tournamentId]);
}

async function getTournamentInfo(tournamentId, select) {
  // Use parameterized query for security
  const results = await select(`SELECT 
     Date as startDate, endDate, Title, Location,
     region, season, Lat, Lon, eventUuid, status,
     pointsForWin, pointsForDraw, pointsForLoss
     FROM tournaments where id=?`, [tournamentId]);
  
  if (!results || results.length === 0) {
    // Handle case where tournament is not found
    // You might want to throw an error or return null/empty object
    console.error(`Tournament with ID ${tournamentId} not found.`);
    return null; 
  }
  const res = results[0]; // Use the first result

  return {
    eventUuid: res.eventUuid,
    status: res.status,
    date: res.startDate, 
    title: res.Title,
    season: res.season,
    location: {
      region: res.region,
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
