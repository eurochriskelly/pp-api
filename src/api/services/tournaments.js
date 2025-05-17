const { v4: uuidv4 } = require('uuid');
const { promisify } = require("util");
const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { buildReport } = require('./tournaments/build-report');
const { sqlGroupStandings } = require('../../lib/queries');

module.exports = (db) => {
  const { select, insert, update, delete: dbDelete } = dbHelper(db);
  const winAward = 3;

  return {
    getTournamentReport: (tournamentId) => {
      return {
        tournamentId,
        abc: '123'
      }
    },
    buildTournamentReport: async (tournamentId) => {
      console.log(`This is and ${tournamentId}`)
      const res = await buildReport(tournamentId, select);
      return res
    },
 // Create multiple fixtures for a tournament
    createFixtures: async (tournamentId, fixtures) => {
      console.log(JSON.stringify(fixtures[0], null, 2))
      try {
        const values = fixtures.map(fixture => {
          let schedTimestamp;
          try {
            schedTimestamp = new Date(fixture.scheduled).toISOString().slice(0, 19).replace("T", " ");
          } catch(e) {
            schedTimestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
          }
          return [
            fixture.id,
            fixture.tournamentId,
            fixture.category,
            fixture.groupNumber,
            fixture.stage,
            fixture.pitch, fixture.pitch,   // planned / actual
            schedTimestamp, schedTimestamp, // planned / actual
            fixture.started,
            fixture.team1Planned,
            fixture.team1Id,
            fixture.goals1,
            fixture.points1,
            fixture.team2Planned,
            fixture.team2Id,
            fixture.goals2,
            fixture.points2,
            fixture.umpireTeamPlanned,
            fixture.umpireTeamId,
            'not played'
          ]
        });
        const result = await insert(
          `INSERT INTO fixtures (
              id, tournamentId, category, groupNumber, 
              stage, pitch, pitchPlanned, scheduled, scheduledPlanned, started, 
              team1Planned, team1Id, goals1, points1, 
              team2Planned, team2Id, goals2, points2, 
              umpireTeamPlanned, umpireTeamId, outcome) VALUES ?`,
          [values]
        );
        const insertedFixtures = fixtures.map((fixture, index) => ({
          ...fixture,
          id: fixture.id
        }));
        return insertedFixtures;
      } catch (err) {
        console.log(err)
        throw new Error(`Failed to create fixtures for tournament ${tournamentId}: ${err.message}`);
      }
    },
        // Create multiple pitches for a tournament
    createPitches: async (tournamentId, pitches) => {
      try {
        const values = pitches.map(pitch => [
          pitch.pitch,
          pitch.location,
          pitch.type,
          tournamentId
        ]);
        const result = await insert(
          `INSERT INTO pitches (pitch, location, type, tournamentId) VALUES ?`,
          [values] // Bulk insert with array of arrays
        );
        const insertedPitches = pitches.map((pitch, index) => ({
          id: result.insertId + index, // Assuming auto-increment ID
          pitch: pitch.pitch,
          location: pitch.location,
          type: pitch.type,
          tournamentId
        }));
        return insertedPitches; // Return created pitch objects
      } catch (err) {
        throw new Error(`Failed to create pitches for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Players CRUD (New)
    createPlayer: async (squadId, { firstName, secondName, dateOfBirth, foirreannId }) => {
      const result = await insert(
        `INSERT INTO players (firstName, secondName, dateOfBirth, foirreannId, teamId) 
         VALUES (?, ?, ?, ?, ?)`,
        [firstName, secondName, dateOfBirth, foirreannId, squadId]
      );
      return result.insertId;
    },

    getPlayers: async (squadId) => {
      return await select(`SELECT * FROM players WHERE teamId = ?`, [squadId]);
    },

    getPlayer: async (id) => {
      const rows = await select(`SELECT * FROM players WHERE id = ?`, [id]);
      return rows[0] || null;
    },

    updatePlayer: async (id, { firstName, secondName, dateOfBirth, foirreannId }) => {
      await update(
        `UPDATE players SET firstName = ?, secondName = ?, dateOfBirth = ?, foirreannId = ? WHERE id = ?`,
        [firstName, secondName, dateOfBirth, foirreannId, id]
      );
    },
    createTournament: async ({ title, date, location, lat, lon, eventUuid = uuidv4() }) => {
      const result = await insert(
        `INSERT INTO tournaments (Title, Date, Location, Lat, Lon, eventUuid) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, date, location, lat, lon, eventUuid]
      );
      return result;
    },

    getTournaments: async (status) => {
      DD('Getting tournaments with status = [' || status || ']');
      let cond = '';
      if (status.toLowerCase() != 'all') {
        const statuses = status.split(',') || []
        cond = `WHERE status IN (${statuses.map(v => `'${v}'`).join(', ')})`
      }
      const sql = `
         SELECT 
           Id, Date, Title, Location, region, season, eventUuid, status, code 
         FROM tournaments
         ${cond}`
      return await select(sql);
    },

    getTournament: async (id, uuid) => {
      let tournament;
      if (uuid) {
        DD(`Getting tournament by uuid [${uuid}]`);
        [tournament] = await select(
          `SELECT id, Date, Title, Location, eventUuid, code 
           FROM tournaments WHERE eventUuid = ?`,
          [uuid]
        );
      } else {
        [tournament] = await select(
          `SELECT id, Date, Title, Location, eventUuid, code 
           FROM tournaments WHERE Id = ?`,
          [id]
        );
      }

      if (!tournament) return null;
      
      const tId = id || tournament.id;
      const [groups, pitches] = await Promise.all([
        select(
          `SELECT category, grp, team 
           FROM ${sqlGroupStandings(winAward)} 
           WHERE tournamentId = ?`,
          [tId]
        ),
        select(
          `SELECT id, pitch, location 
           FROM pitches 
           WHERE tournamentId = ?`,
          [tId]
        )
      ]);

      return {
        ...tournament,
        groups,
        pitches,
        categories: [...new Set(groups.map(g => g.category))]
      };
    },

    // Squads CRUD (Updated from teams)
    createSquad: async (tournamentId, { teamName, groupLetter, category, teamSheetSubmitted, notes }) => {
      const result = await insert(
        `INSERT INTO squads (teamName, groupLetter, category, teamSheetSubmitted, notes, tournamentId) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [teamName, groupLetter, category, teamSheetSubmitted || false, notes, tournamentId]
      );
      return result.insertId;
    },

    // Delete all cards for a tournament
    deleteCards: async (tournamentId) => {
      console.log('this is failing ...')
      try {
        const result = await dbDelete(
          `DELETE FROM cards WHERE tournamentId = ?`,
          [tournamentId]
        );
        console.log('res', result)
        return { affectedRows: result.affectedRows };
      } catch (err) {
        throw new Error(`Failed to delete cards for tournament ${tournamentId}: ${err.message}`);
      }
    },

    deleteFixtures: async (tournamentId) => {
      try {
        console.log('Deleting cards')
        await dbDelete(`DELETE FROM cards WHERE tournamentId = ?`, [tournamentId]);
        console.log('Deleting fixtures')
        const result = await dbDelete(
          `DELETE FROM fixtures WHERE tournamentId = ?`,
          [tournamentId]
        );
        return { affectedRows: result.affectedRows }; // Return count of deleted rows
      } catch (err) {
        throw new Error(`Failed to delete fixtures for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Delete all pitches for a tournament
    deletePitches: async (tournamentId) => {
      try {
        const result = await dbDelete(
          `DELETE FROM pitches WHERE tournamentId = ?`,
          [tournamentId]
        );
        return { affectedRows: result.affectedRows };
      } catch (err) {
        throw new Error(`Failed to delete pitches for tournament ${tournamentId}: ${err.message}`);
      }
    },

    deletePlayer: async (id) => {
      await dbDelete(`DELETE FROM players WHERE id = ?`, [id]);
    },
    
    deleteSquad: async (id) => {
      await dbDelete(`DELETE FROM squads WHERE id = ?`, [id]);
    },

    deleteTournament: async (id) => {
      await dbDelete(
        `DELETE FROM tournaments WHERE id = ?`,
        [id]
      );
    },

    getAllMatches: async (id) => {
      return await select(
        `SELECT id, category, groupNumber AS grp, stage, pitch, scheduledTime, 
                team1, goals1, points1, team2, goals2, points2, umpireTeam as umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? 
         ORDER BY scheduledTime, id`,
        [id]
      );
    },
    
    getCardedPlayers: async (tournamentId) => {
      return await select(
        `SELECT c.playerId, p.firstName, p.secondName, c.team, c.cardColor 
         FROM cards c 
         JOIN players p ON c.playerId = p.id 
         WHERE c.tournamentId = ? 
         ORDER BY c.team, p.firstName`,
        [tournamentId]
      );
    },

    getFinalsResults: async (id) => {
      return await select(
        `SELECT category, REPLACE(stage, '_finals', '') AS division, team1, goals1, points1, team2, goals2, points2, outcome,
                CASE WHEN (goals1 * 3 + points1) > (goals2 * 3 + points2) THEN team1 
                     WHEN (goals1 * 3 + points1) < (goals2 * 3 + points2) THEN team2 
                     ELSE 'Draw' END AS winner 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage LIKE '%finals' 
         ORDER BY category`,
        [id]
      );
    },
    getGroupFixtures: async (id) => {
      return await select(
        `SELECT id, category, groupNumber AS g, pitch, scheduledTime, team1, goals1, points1, team2, goals2, points2, umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage = 'group' 
         ORDER BY category, scheduledTime`,
        [id]
      );
    },

    getGroupStandings: async (id, category, groupNumber, format) => {
      let groupsQuery = `SELECT DISTINCT grp as gnum, category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`;
      let queryParams = [id];

      // Add filters if category and/or groupNumber are provided
      if (category) {
        groupsQuery += " AND category = ?";
        queryParams.push(category);
      }

      if (groupNumber) {
        groupsQuery += " AND grp = ?";
        queryParams.push(groupNumber);
      }

      const groups = await select(groupsQuery, queryParams);

      // Collect all rows first to calculate overall rankings
      const allTeams = [];
      const groupStandingsMap = {};

      // First pass: Collect data and add group rankings
      for (const { gnum, category: groupCategory } of groups) {
        const rows = await select(
          `SELECT category, grp, team, tournamentId, MatchesPlayed, Wins, Draws, Losses, PointsFrom, PointsDifference, TotalPoints 
           FROM ${sqlGroupStandings(winAward)} 
           WHERE tournamentId = ? AND category = ? AND grp = ? 
           ORDER BY TotalPoints DESC, PointsDifference DESC, PointsFrom DESC`,
          [id, groupCategory, gnum]
        );

        // Add group ranking to each team
        rows.forEach((team, index) => {
          team.rankGroup = index + 1;

          // Store reference for later grouping
          if (!groupStandingsMap[groupCategory]) {
            groupStandingsMap[groupCategory] = {};
          }
          if (!groupStandingsMap[groupCategory][gnum]) {
            groupStandingsMap[groupCategory][gnum] = [];
          }
          groupStandingsMap[groupCategory][gnum].push(team);

          // Add to flat list for category ranking calculation
          allTeams.push(team);
        });
      }

      // Second pass: Calculate category rankings
      // Group teams by category
      const teamsByCategory = {};
      allTeams.forEach(team => {
        if (!teamsByCategory[team.category]) {
          teamsByCategory[team.category] = [];
        }
        teamsByCategory[team.category].push(team);
      });

      // Sort and assign category rankings
      Object.keys(teamsByCategory).forEach(cat => {
        teamsByCategory[cat].sort((a, b) => {
          if (a.TotalPoints !== b.TotalPoints) return b.TotalPoints - a.TotalPoints;
          if (a.PointsDifference !== b.PointsDifference) return b.PointsDifference - a.PointsDifference;
          return b.PointsFrom - a.PointsFrom;
        });

        teamsByCategory[cat].forEach((team, index) => {
          team.rankCategory = index + 1;
        });
      });

      // Third pass: Calculate "best of" rankings
      // Group teams by category and group ranking
      const teamsByCategoryAndRank = {};
      allTeams.forEach(team => {
        const key = `${team.category}_${team.rankGroup}`;
        if (!teamsByCategoryAndRank[key]) {
          teamsByCategoryAndRank[key] = [];
        }
        teamsByCategoryAndRank[key].push(team);
      });

      // Sort and assign "best of" rankings
      Object.keys(teamsByCategoryAndRank).forEach(key => {
        teamsByCategoryAndRank[key].sort((a, b) => {
          if (a.TotalPoints !== b.TotalPoints) return b.TotalPoints - a.TotalPoints;
          if (a.PointsDifference !== b.PointsDifference) return b.PointsDifference - a.PointsDifference;
          return b.PointsFrom - a.PointsFrom;
        });

        teamsByCategoryAndRank[key].forEach((team, index) => {
          team.rankBestOf = index + 1;
        });
      });

      // If CSV format is requested, output to console
      // Also, run this logic if 'internal_completion_calc' format is used to populate completion fields
      if ((format === 'csv' || format === 'internal_completion_calc') && allTeams.length > 0) {
        // Sort teams by rankCategory in descending order
        // For 'internal_completion_calc', sorting isn't strictly needed here but doesn't harm
        const sortedTeams = (format === 'csv') ? [...allTeams].sort((a, b) => a.rankCategory - b.rankCategory) : [...allTeams];

        // Group teams by category and group for calculating completion status
        const groupSizes = {};
        const groupPlayedMatches = {};
        const categoryGroups = {}; // Track groups in each category
        const categoryGroupCompletion = {}; // Track completion status for each category

        // Calculate group sizes first
        sortedTeams.forEach(team => {
          const key = `${team.category}_${team.grp}`;
          groupSizes[key] = (groupSizes[key] || 0) + 1;
          // Initialize the played matches counter
          if (!groupPlayedMatches[key]) groupPlayedMatches[key] = 0;

          // Track which groups belong to which category
          if (!categoryGroups[team.category]) {
            categoryGroups[team.category] = new Set();
          }
          categoryGroups[team.category].add(team.grp);
        });

        // Add the calculated fields before generating CSV
        sortedTeams.forEach(team => {
          team.MatchesTotal = team.MatchesPlayed; // Store the original value with new name
          team.MatchesPlayed = team.Wins + team.Draws + team.Losses; // Calculate new field

          const key = `${team.category}_${team.grp}`;
          const expectedMatchesPerTeam = groupSizes[key] - 1;

          // Determine if team has completed all its matches
          team.completedTeam = team.MatchesPlayed >= expectedMatchesPerTeam ? 1 : 0;

          // Add team's matches to group total
          groupPlayedMatches[key] += team.MatchesPlayed;
        });

        // Calculate group completion status
        sortedTeams.forEach(team => {
          const key = `${team.category}_${team.grp}`;
          const groupSize = groupSizes[key];
          const totalExpectedMatches = (groupSize * (groupSize - 1)) / 2; // Formula for total matches in round robin
          // Each match is counted twice (once for each team) in our data
          const actualGroupMatches = groupPlayedMatches[key] / 2;

          // Determine if group has completed all matches
          team.completedGroup = actualGroupMatches >= totalExpectedMatches ? 1 : 0;

          // Track group completion for category calculation
          if (!categoryGroupCompletion[team.category]) {
            categoryGroupCompletion[team.category] = {};
          }
          categoryGroupCompletion[team.category][team.grp] = team.completedGroup;
        });

        // Calculate category completion status
        sortedTeams.forEach(team => {
          const groupsDefinedForThisCategory = categoryGroups[team.category]; // Set of group numbers for this team's category
          let allActualGroupsAreComplete = false; // Default to false

          if (groupsDefinedForThisCategory && groupsDefinedForThisCategory.size > 0) {
            allActualGroupsAreComplete = true; // Assume true, try to disprove
            for (const grpNum of groupsDefinedForThisCategory) {
              // Check if this specific group (grpNum) in this category (team.category) is marked as complete (status === 1)
              if (!categoryGroupCompletion[team.category] || categoryGroupCompletion[team.category][grpNum] !== 1) {
                allActualGroupsAreComplete = false; // Found a group not complete or status not recorded
                break;
              }
            }
          }
          team.completedCategory = allActualGroupsAreComplete ? 1 : 0;
        });

        // Define CSV columns with all fields
        const columns = [
          'category', 'grp', 'team', 'rankGroup', 'rankCategory', 'rankBestOf',
          'MatchesPlayed', 'MatchesTotal', 'Wins', 'Draws', 'Losses',
          'PointsFrom', 'PointsDifference', 'TotalPoints',
          'completedTeam', 'completedGroup', 'completedCategory'
        ];

        // Create header row
        const header = columns.join(',');

        // Create data rows
        const rows = sortedTeams.map(team => {
          return columns.map(col => {
            // Handle any special formatting or missing values
            const value = team[col] !== undefined ? team[col] : '';
            // Escape any commas or quotes in string values
            return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
          }).join(',');
        });

        // Output the CSV only if format is 'csv'
        if (format === 'csv') {
          console.log(header);
          rows.forEach(row => console.log(row));
        }
      }

      // Return in the original structured format
      // If 'internal_completion_calc' was used, team objects in groupStandingsMap now have completion fields.
      return groupStandingsMap;
    },

    getKnockoutFixtures: async (id) => {
      return await select(
        `SELECT id, category, stage, pitch, scheduledTime, team1, goals1, points1, team2, goals2, points2, umpireTeam, outcome,
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND stage != 'group' 
         ORDER BY category, scheduledTime`,
        [id]
      );
    },
    getMatchesByPitch: async (tournamentId) => {
      return await select(
        `SELECT id, pitch, stage, scheduledTime, category, team1, goals1, points1, team2, goals2, points2, umpireTeam, 
                IF(started IS NULL, 'false', 'true') AS started 
         FROM v_fixture_information 
         WHERE tournamentId = ? 
         ORDER BY pitch, scheduledTime`,
        [tournamentId]
      );
    },

    resetTournament: async (id) => {
      await update(
        `UPDATE fixtures SET 
          started = NULL, 
          ended = NULL, 
          scheduled = scheduledPlanned, 
          pitch = pitchPlanned, 
          team1Id = team1Planned,
          team2Id = team2Planned,
          umpireTeamId = umpireTeamPlanned,
          goals1 = NULL, 
          points1 = NULL, 
          goals2 = NULL, 
          points2 = NULL, 
          outcome = 'not played' 
         WHERE tournamentId = ?`,
        [id]
      );
    },

    getRecentMatches: async (tournamentId) => {
      return await select(
        `SELECT id, DATE_FORMAT(DATE_ADD(started, INTERVAL 2 HOUR), '%H:%i') as start, pitch, 
          groupNumber as grp, stage, category as competition, team1, 
          CONCAT(goals1, '-', LPAD(points1, 2, '0'), ' (', LPAD(IF(goals1 IS NOT NULL AND points1 IS NOT NULL, goals1 * 3 + points1, 'N/A'), 2, '0'), ')') AS score1, 
          team2, CONCAT(goals2, '-', LPAD(points2, 2, '0'), ' (', LPAD(IF(goals2 IS NOT NULL AND points2 IS NOT NULL, goals2 * 3 + points2, 'N/A'), 2, '0'), ')') AS score2, umpireTeam 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND started IS NOT NULL 
         ORDER BY started DESC 
         LIMIT 12`,
        [tournamentId]
      );
    },

    getStartedMatchCount: async (tournamentId) => {
      const [result] = await select(
        `SELECT COUNT(*) as count 
         FROM v_fixture_information 
         WHERE tournamentId = ? AND goals1 IS NOT NULL`,
        [tournamentId]
      );
      return result.count;
    },

    getSquad: async (tournamentId, id) => {
      const rows = await select(`SELECT * FROM squads WHERE tournamentId = ? AND id = ?`, [tournamentId, id]);
      return rows[0] || null;
    },

    getSquads: async (tournamentId) => {
      return await select(`SELECT * FROM squads WHERE tournamentId = ?`, [tournamentId]);
    },
    getTournament: async (id, uuid) => {
      let tournamentRows;
      if (uuid) {
        console.log(`Getting tournaments by uuid [${uuid}]`);
        tournamentRows = await select(`SELECT id, Date, Title, Location, eventUuid, code FROM tournaments WHERE eventUuid = ?`, [uuid]);
      } else {
        tournamentRows = await select(`SELECT id, Date, Title, Location, eventUuid, code FROM tournaments WHERE Id = ?`, [id]);
      }
      if (!tournamentRows) return null
      if (!tournamentRows?.length) return null;
      const tournament = tournamentRows.shift();
      const tId = id || tournament.id; // if we had to get the tournament from it's uuid, use this instead
      const q = `SELECT category, grp, team FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`
      const [groups, pitches] = await Promise.all([
        select(`SELECT category, grp, team FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`, [tId]),
        select(`SELECT id, pitch, location FROM pitches WHERE tournamentId = ?`, [tId]),
      ]);
      tournament.groups = groups;
      tournament.pitches = pitches;
      tournament.categories = [...new Set(groups.map(g => g.category))];
      return tournament;
    },

    getTournamentCategories: async (id) => {
      const rows = await select(`SELECT * FROM v_categories WHERE tournamentId = ?`, [id]);
      return rows.map(row => ({
        ...row,
        brackets: row.brackets.split(",").map(x => x.trim())
      }));
    },

    resetTournament: async (id) => {
      await update(
        `UPDATE fixtures SET 
          started = NULL, 
          ended = NULL, 
          scheduled = scheduledPlanned, 
          pitch = pitchPlanned, 
          team1Id = team1Planned,
          team2Id = team2Planned,
          umpireTeamId = umpireTeamPlanned,
          goals1 = NULL, 
          points1 = NULL, 
          goals2 = NULL, 
          points2 = NULL, 
          outcome = 'not played' 
          WHERE tournamentId = ?
        `,
        [id]
      );
    },
    updateSquad: async (id, { teamName, groupLetter, category, teamSheetSubmitted, notes }) => {
      await update(
        `UPDATE squads SET teamName = ?, groupLetter = ?, category = ?, teamSheetSubmitted = ?, notes = ? WHERE id = ?`,
        [teamName, groupLetter, category, teamSheetSubmitted || false, notes, id]
      );
    },

    updateTournament: async (id, { title, date, location, lat, lon }) => {
      await update(
        `UPDATE tournaments 
         SET Title = ?, Date = ?, Location = ?, Lat = ?, Lon = ? 
         WHERE id = ?`,
        [title, date, location, lat, lon, id]
      );
    },
  };

};
