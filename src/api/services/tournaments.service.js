const { v4: uuidv4 } = require('uuid');
const { promisify } = require("util");
const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { sqlGroupStandings } = require('../../lib/queries');

module.exports = (db) => {
  const { select, insert, update, delete: dbDelete } = dbHelper(db);
  const winAward = 3;

  return {
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

    getTournaments: async () => {
      DD('Getting all tournaments');
      return await select(
        `SELECT Id, Date, Title, Location, eventUuid FROM tournaments`
      );
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

    getTournaments: async () => {
      console.log('geting tournaments')
      return await select(`SELECT Id, Date, Title, Location, eventUuid FROM tournaments`);
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
