const { friendlyTeamLabel } = require('./utils/teamFormatting');
const {
  calcBracket,
  calcStage,
  getMatchStatus,
  generateMatchLabel,
} = require('./utils/stageFormatting');
const { calculateStandings } = require('./utils/standingsCalculation');
const { calculateTeamSummary } = require('./utils/teamSummaryCalculation');

class ReportBuilder {
  constructor(select) {
    this.select = select;
  }

  async build(tournamentId, category) {
    const tournament = await this.getTournamentInfo(tournamentId);
    const pitches = await this.getPitchInfo(tournamentId);
    // Get the basic category info (teams, groups)
    const categoryTeamInfo = await this.getCategoriesInfo(tournamentId);
    const cardsByFixtureId = await this.getCardsForTournament(tournamentId);

    // Filter categories if a specific category is provided
    const filteredCategoryTeamInfo = category
      ? categoryTeamInfo.filter(
          (catInfo) => catInfo.category.toUpperCase() === category.toUpperCase()
        )
      : categoryTeamInfo;

    // Now, for each category, fetch and structure its fixtures
    const categoriesWithFixtures = await Promise.all(
      filteredCategoryTeamInfo.map(async (catInfo) => {
        const fixtures = await this.getFixturesForCategory(
          tournamentId,
          catInfo.category,
          cardsByFixtureId
        );
        const standings = calculateStandings(
          fixtures,
          catInfo.byGroup,
          tournament.pointsFor
        );
        const teamSummary = calculateTeamSummary(
          catInfo.allTeams,
          fixtures,
          catInfo.byGroup,
          catInfo.byBracket,
          standings
        );

        return {
          category: catInfo.category,
          teams: {
            // Keep the teams structure from getCategoriesInfo
            allTeams: catInfo.allTeams,
            byGroup: catInfo.byGroup,
            byBracket: catInfo.byBracket,
            summary: teamSummary,
          },
          fixtures: fixtures, // Add the structured fixtures
          standings: standings,
        };
      })
    );

    let lastUpdate = null;
    for (const categoryData of categoriesWithFixtures) {
      const categoryLastUpdated = categoryData?.fixtures?.lastUpdated;
      if (
        categoryLastUpdated &&
        (!lastUpdate || new Date(categoryLastUpdated) > new Date(lastUpdate))
      ) {
        lastUpdate = categoryLastUpdated;
      }
    }

    return {
      tournamentId,
      lastUpdate,
      tournament,
      pitches,
      categories: categoriesWithFixtures, // Use the combined data
    };
  }

  async getCardsForTournament(tournamentId) {
    const cards = await this.select(
      `SELECT fixtureId, playerNumber, playerName, team, cardColor 
       FROM cards 
       WHERE tournamentId = ? AND fixtureId IS NOT NULL`,
      [tournamentId]
    );

    const cardsByFixtureId = new Map();
    cards.forEach((card) => {
      if (!cardsByFixtureId.has(card.fixtureId)) {
        cardsByFixtureId.set(card.fixtureId, []);
      }
      cardsByFixtureId.get(card.fixtureId).push({
        playerNumber: card.playerNumber,
        playerName: card.playerName,
        team: card.team,
        cardColor: card.cardColor,
      });
    });
    return cardsByFixtureId;
  }

  async getCategoriesInfo(tournamentId) {
    // Fetch distinct category names first
    const categoryRows = await this.select(
      `SELECT DISTINCT category FROM fixtures WHERE tournamentId=? ORDER BY category`,
      [tournamentId]
    );

    // Process each category to get the desired structure
    const categoryPromises = categoryRows.map(async (catRow) => {
      const category = catRow.category;

      // 1. Get all unique teams for the category
      const allTeamsResult = await this.select(
        `
        SELECT DISTINCT team FROM (
          SELECT team1Id as team FROM fixtures 
          WHERE tournamentId=? AND category=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
          UNION 
          SELECT team2Id as team FROM fixtures 
          WHERE tournamentId=? AND category=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
        ) AS combined_teams ORDER BY team
      `,
        [tournamentId, category, tournamentId, category]
      );
      const allTeams = allTeamsResult.map((t) => t.team);

      // 2. Get distinct group numbers for the category where stage is 'group'
      const groupNumberRows = await this.select(
        `
        SELECT DISTINCT groupNumber FROM fixtures 
        WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber IS NOT NULL 
        ORDER BY groupNumber
      `,
        [tournamentId, category]
      );

      // 3. For each group number, get the teams in that specific group
      const groupPromises = groupNumberRows.map(async (groupRow) => {
        const groupNumber = groupRow.groupNumber;
        const groupTeamsResult = await this.select(
          `
          SELECT DISTINCT team FROM (
            SELECT team1Id as team FROM fixtures 
            WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
            UNION 
            SELECT team2Id as team FROM fixtures 
            WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
          ) AS group_teams ORDER BY team
        `,
          [
            tournamentId,
            category,
            groupNumber,
            tournamentId,
            category,
            groupNumber,
          ]
        );

        return {
          group: groupNumber,
          teams: groupTeamsResult.map((t) => t.team),
        };
      });

      const byGroup = await Promise.all(groupPromises);

      // 4. Get teams by bracket
      const bracketFixtures = await this.select(
        `
        SELECT stage, team1Id, team2Id 
        FROM fixtures 
        WHERE tournamentId=? AND category=? AND stage != 'group'
      `,
        [tournamentId, category]
      );

      const teamsByBracketMap = new Map();
      const teamsInAnyBracket = new Set();

      bracketFixtures.forEach((fixture) => {
        const bracketName = calcBracket(fixture.stage);
        if (bracketName === 'group' || bracketName === 'Unknown') return;

        if (!teamsByBracketMap.has(bracketName)) {
          teamsByBracketMap.set(bracketName, new Set());
        }
        const bracketTeamsSet = teamsByBracketMap.get(bracketName);

        if (fixture.team1Id && !fixture.team1Id.startsWith('~')) {
          bracketTeamsSet.add(fixture.team1Id);
          teamsInAnyBracket.add(fixture.team1Id);
        }
        if (fixture.team2Id && !fixture.team2Id.startsWith('~')) {
          bracketTeamsSet.add(fixture.team2Id);
          teamsInAnyBracket.add(fixture.team2Id);
        }
      });

      // Determine teams not in any bracket
      const noneBracketTeams = allTeams.filter(
        (team) => !teamsInAnyBracket.has(team)
      );
      if (noneBracketTeams.length > 0) {
        teamsByBracketMap.set('None', new Set(noneBracketTeams));
      }

      // Convert map to the desired array structure and sort teams
      const byBracket = [];
      for (const [bracket, teamsSet] of teamsByBracketMap.entries()) {
        byBracket.push({
          bracket: bracket,
          teams: Array.from(teamsSet).sort(),
        });
      }
      byBracket.sort((a, b) => a.bracket.localeCompare(b.bracket));

      // 5. Assemble the final object for the category
      return {
        category: category,
        allTeams: allTeams,
        byGroup: byGroup,
        byBracket: byBracket,
      };
    });

    // Wait for all category processing promises to resolve
    return Promise.all(categoryPromises);
  }

  async getFixturesForCategory(tournamentId, category, cardsByFixtureId) {
    const fixturesData = await this.select(
      `
      SELECT 
        id, tournamentId, category, groupNumber, stage, 
        pitchPlanned, pitch, 
        scheduledPlanned, scheduled, started, ended, durationPlanned,
        team1Planned, team1Id as team1, team2Planned, team2Id as team2, 
        goals1, points1, goals1Extra, points1Extra, goals1Penalties, 
        goals2, points2, goals2Extra, points2Extra, goals2Penalties, 
        umpireTeamPlanned, umpireTeamId, 
        outcome, 
        created, updated 
      FROM fixtures 
      WHERE tournamentId = ? AND category = ?
      ORDER BY stage, groupNumber, scheduledPlanned, id
    `,
      [tournamentId, category]
    );

    let lastUpdated = null;
    const groupFixtures = [];
    const knockoutFixtures = [];

    fixturesData.forEach((f) => {
      // Update lastUpdated
      if (
        !lastUpdated ||
        (f.updated && new Date(f.updated) > new Date(lastUpdated))
      ) {
        lastUpdated = f.updated;
      }

      f.total1 = f.outcome !== 'not played' ? f.goals1 * 3 + f.points1 : null;
      f.total2 = f.outcome !== 'not played' ? f.goals2 * 3 + f.points2 : null;

      const actualDuration =
        f.started && f.ended
          ? Math.round((new Date(f.ended) - new Date(f.started)) / 60000)
          : null;

      const transformedFixture = {
        matchId: f.id,
        matchLabel: generateMatchLabel(f.category, f.id),
        cards: cardsByFixtureId.get(f.id) || [],
        pool: f.stage === 'group' ? f.groupNumber : null, // Use groupNumber for pool in group stage
        bracket: calcBracket(f.stage),
        stage: calcStage(f.stage, f.groupNumber),
        planned: {
          team1: f.team1Planned,
          team2: f.team2Planned,
          umpireTeam: f.umpireTeamPlanned,
          scheduled: f.scheduledPlanned,
          pitch: f.pitchPlanned,
          duration: f.durationPlanned,
        },
        actual: {
          scheduled: f.scheduled,
          pitch: f.pitch,
          started: f.started,
          ended: f.ended,
          duration: actualDuration,
        },
        team1: {
          name: friendlyTeamLabel(f.team1),
          goals: f.goals1,
          points: f.points1,
          total: f.total1,
          goalsExtra: f.goals1Extra,
          pointsExtra: f.points1Extra,
          goalsPenalties: f.goals1Penalties,
          status: getMatchStatus(f.outcome, f.total1, f.total2),
        },
        team2: {
          name: friendlyTeamLabel(f.team2),
          goals: f.goals2,
          points: f.points2,
          total: f.total2,
          goalsExtra: f.goals2Extra,
          pointsExtra: f.points2Extra,
          goalsPenalties: f.goals2Penalties,
          status: getMatchStatus(f.outcome, f.total2, f.total1),
        },
        umpireTeam: friendlyTeamLabel(f.umpireTeamId),
        outcome: f.outcome,
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

  async getPitchInfo(tournamentId) {
    // Use parameterized query for security - get distinct pitches
    return await this.select(
      `
      SELECT DISTINCT pitch, MIN(id) as id, MIN(location) as location 
      FROM pitches 
      WHERE tournamentId=? 
      GROUP BY pitch
      ORDER BY pitch
    `,
      [tournamentId]
    );
  }

  async getTournamentInfo(tournamentId) {
    // Use parameterized query for security
    const results = await this.select(
      `SELECT 
       Date as startDate, endDate, Title, Location,
       region, season, Lat, Lon, eventUuid, status,
       pointsForWin, pointsForDraw, pointsForLoss
       FROM tournaments where id=?`,
      [tournamentId]
    );

    if (!results || results.length === 0) {
      // Handle case where tournament is not found
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
      },
    };
  }
}

module.exports = { ReportBuilder };
