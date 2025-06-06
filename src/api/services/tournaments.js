const { v4: uuidv4 } = require('uuid');
const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { buildReport } = require('./tournaments/build-report');
const { sqlGroupStandings } = require('../../lib/queries');
const TSVValidator = require('./fixtures/validate-tsv');
const { buildFixturesInsertSQL } = require('./tournaments/import-fixtures.js');

const createPitches = async (insert, tournamentId, pitches) => {
  try {
    const values = pitches.map(pitch => [
      pitch.pitch,
      pitch.location,
      pitch.type,
      tournamentId
    ]);
    const result = await insert(
      `INSERT INTO pitches (pitch, location, type, tournamentId) VALUES ?`,
      [values]
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
}

const deleteCards = async (dbDelete, tournamentId) => {
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
}

const deleteFixtures = async (dbDelete, tournamentId) => {
  try {
    await dbDelete(`SET FOREIGN_KEY_CHECKS = 0`);
    await dbDelete(`DELETE FROM cards WHERE tournamentId = ?`, [tournamentId]);
    await dbDelete(`SET FOREIGN_KEY_CHECKS = 1`);
    const result = await dbDelete(
      `DELETE FROM fixtures WHERE tournamentId = ?`,
      [tournamentId]
    );
    return { affectedRows: result.affectedRows }; // Return count of deleted rows
  } catch (err) {
    throw new Error(`Failed to delete fixtures for tournament ${tournamentId}: ${err.message}`);
  }
}

const deletePitches = async (dbDelete, tournamentId) => {
  try {
    const result = await dbDelete(
      `DELETE FROM pitches WHERE tournamentId = ?`,
      [tournamentId]
    );
    return { affectedRows: result.affectedRows };
  } catch (err) {
    throw new Error(`Failed to delete pitches for tournament ${tournamentId}: ${err.message}`);
  }
}

module.exports = (db) => {
  const { select, insert, update, delete: dbDelete } = dbHelper(db);
  const winAward = 3;
  return {
    codeCheck: async (tournamentId, code, role) => {
      const roleCodeMap = {
        organizer: 'code',
        coordinator: 'codeCoordinator',
        referee: 'codeReferee',
        coach: 'codeTeam'
      };

      if (!roleCodeMap[role]) {
        throw new Error(`Invalid role: ${role}`);
      }

      const [row] = await select(
        `SELECT ${roleCodeMap[role]} AS roleCode FROM tournaments WHERE id = ?`,
        [tournamentId]
      );

      DD(`Checking code for role ${role} in tournament ${tournamentId}: expected ${row?.roleCode}, got ${code}`);
      if (!row || row.roleCode !== code) {
        throw new Error('Invalid code for the specified role.');
      }

      return true;
    },

    validateTsv: (tsvEncoded) => new TSVValidator(tsvEncoded, { restGapMultiplier: 1 }).validate(),

    getTournamentReport: (tournamentId) => {
      return {
        tournamentId,
        abc: '123'
      }
    },
    buildTournamentReport: async (tournamentId) => {
      const res = await buildReport(tournamentId, select);
      return res
    },
   // Create multiple fixtures for a tournament
    createFixtures: async (tournamentId, fixtureRows) => {
      try {
        const pitches = fixtureRows.map(row => {
          return {
            pitch: row.PITCH, 
            location: null,
            type: 'grass',
            tournamentId
          }
        });
        const sql = buildFixturesInsertSQL(fixtureRows, tournamentId, '2025-01-01');
        await deletePitches(dbDelete, tournamentId);
        await deleteFixtures(dbDelete, tournamentId);
        await createPitches(insert, tournamentId, pitches)
        await insert(sql);
        return {}
      } catch (err) {
        console.log(err)
        throw new Error(`Failed to create fixtures for tournament ${tournamentId}: ${err.message}`);
      }
    },

    // Create multiple pitches for a tournament
    createPitches: createPitches.bind(insert),

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

    getTournaments: async (status, userId, role) => {
      DD(`Getting tournaments with status=[${status}], userId=[${userId}], role=[${role}]`);
      
      let cond = [];
      let params = [];
      
      if (status.toLowerCase() != 'all') {
        const statuses = status.split(',') || [];
        cond.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
      
      if (userId && role) {
        cond.push(`sr.UserId = ? AND sr.RoleName = ?`);
        params.push(userId, role);
      }
      
      const whereClause = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
      
      const sql = `
        SELECT DISTINCT 
          t.Id, t.Date, t.Title, t.Location, t.region, t.season, t.eventUuid, t.status, t.code 
        FROM tournaments t
        ${userId && role ? 'JOIN sec_roles sr ON t.Id = sr.tournamentId' : ''}
        ${whereClause}
        ORDER BY t.Date DESC`;
        
      return await select(sql, params);
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

    deleteCards: deleteCards.bind(dbDelete),
    deleteFixtures: deleteFixtures.bind(dbDelete),
    deletePitches: deletePitches.bind(dbDelete),

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

    getGroupStandings: async (id) => {
      const groups = await select(
        `SELECT DISTINCT grp as gnum, category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ?`,
        [id]
      );
      const standings = {};
      for (const { gnum, category } of groups) {
        const rows = await select(
          `SELECT category, grp, team, tournamentId, MatchesPlayed, Wins, Draws, Losses, PointsFrom, PointsDifference, TotalPoints 
           FROM ${sqlGroupStandings(winAward)} 
           WHERE tournamentId = ? AND category = ? AND grp LIKE ? 
           ORDER BY TotalPoints DESC, PointsDifference DESC, PointsFrom DESC`,
          [id, category, gnum]
        );
        standings[category] = standings[category] || {};
        standings[category][gnum] = rows;
      }
      return standings;
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

    getFilters: async (tournamentId, queryRole, queryCategory) => {
      II(`Fetching filters for tournament [${tournamentId}], role [${queryRole}], category [${queryCategory || 'N/A'}]`);

      // 1. Fetch Competition choices
      const compChoicesData = await select('SELECT DISTINCT(category) AS choice FROM fixtures WHERE tournamentId=? ORDER BY choice', [tournamentId]);
      const competitionChoices = compChoicesData.map(r => r.choice);

      // 2. Fetch Pitch choices
      const pitchChoicesData = await select("SELECT DISTINCT(pitchPlanned) AS choice FROM fixtures WHERE tournamentId=? AND pitchPlanned IS NOT NULL AND TRIM(pitchPlanned) != '' ORDER BY choice", [tournamentId]);
      const pitchChoices = pitchChoicesData.map(r => r.choice);

      // 3. Fetch Team choices (depends on queryCategory)
      let teamSQL = `
        SELECT final_team_identifier AS choice FROM (
            SELECT DISTINCT CONCAT(f.category, '/', f.team1Planned) AS final_team_identifier
            FROM fixtures f
            WHERE f.tournamentId = ? AND f.stage = 'group'
              AND f.team1Planned IS NOT NULL AND TRIM(f.team1Planned) <> '' AND f.team1Planned NOT LIKE '~%'
            UNION
            SELECT DISTINCT CONCAT(f.category, '/', f.team2Planned) AS final_team_identifier
            FROM fixtures f
            WHERE f.tournamentId = ? AND f.stage = 'group'
              AND f.team2Planned IS NOT NULL AND TRIM(f.team2Planned) <> '' AND f.team2Planned NOT LIKE '~%'
        ) AS combined_teams
        ORDER BY choice;
      `;
      const teamParamsInitial = [tournamentId, tournamentId];
      let teamParams = [...teamParamsInitial];

      if (queryCategory) {
        teamSQL = `
          SELECT final_team_identifier AS choice FROM (
              SELECT DISTINCT CONCAT(f.category, '/', f.team1Planned) AS final_team_identifier
              FROM fixtures f
              WHERE f.tournamentId = ? AND f.category = ? AND f.stage = 'group'
                AND f.team1Planned IS NOT NULL AND TRIM(f.team1Planned) <> '' AND f.team1Planned NOT LIKE '~%'
              UNION
              SELECT DISTINCT CONCAT(f.category, '/', f.team2Planned) AS final_team_identifier
              FROM fixtures f
              WHERE f.tournamentId = ? AND f.category = ? AND f.stage = 'group'
                AND f.team2Planned IS NOT NULL AND TRIM(f.team2Planned) <> '' AND f.team2Planned NOT LIKE '~%'
          ) AS combined_teams
          ORDER BY choice;
        `;
        teamParams = [tournamentId, queryCategory, tournamentId, queryCategory];
      }
      const teamChoicesData = await select(teamSQL, teamParams);
      const teamChoices = teamChoicesData.map(r => r.choice);

      // 4. Referee choices (TODO: Define source for referee choices from DB)
      const refereeChoices = [];

      const allFilterDefinitions = {
        competition: {
          icon: 'CompIcon',
          category: 'Competition',
          choices: competitionChoices,
          allowMultiselect: true,
          selected: null,
          default: competitionChoices.length > 0 ? competitionChoices[0] : null
        },
        pitches: {
          icon: 'PitchIcon',
          category: 'Pitches',
          choices: pitchChoices,
          selected: [],
          allowMultiselect: true,
          default: null
        },
        teams: {
          icon: 'TeamIcon',
          category: 'Teams',
          choices: teamChoices,
          selected: [],
          allowMultiselect: true,
          default: null
        },
        referee: {
          icon: 'RefIcon',
          category: 'Referee',
          choices: refereeChoices,
          selected: null,
          allowMultiselect: false,
          default: null
        }
      };

      const roleFilterKeysMap = {
        organizer: ['competition', 'pitches', 'referee'],
        referee: ['competition', 'pitches', 'referee'],
        coach: ['competition', 'referee'],
        coordinator: ['pitches']
      };

      const roleFilterKeys = roleFilterKeysMap[queryRole];

      if (!roleFilterKeys) {
        II(`Unknown role [${queryRole}] for filters, returning empty array.`);
        return [];
      }
      
      return roleFilterKeys.map(key => allFilterDefinitions[key]);
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
