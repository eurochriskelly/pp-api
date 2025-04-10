const { v4: uuidv4 } = require('uuid');
const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { sqlGroupStandings } = require('../../lib/queries');

module.exports = (db) => {
  const { select, insert, update, delete: dbDelete } = dbHelper(db);
  const winAward = 3;

  return {
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

    updateTournament: async (id, { title, date, location, lat, lon }) => {
      await update(
        `UPDATE tournaments 
         SET Title = ?, Date = ?, Location = ?, Lat = ?, Lon = ? 
         WHERE id = ?`,
        [title, date, location, lat, lon, id]
      );
    },

    deleteTournament: async (id) => {
      await dbDelete(
        `DELETE FROM tournaments WHERE id = ?`,
        [id]
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
    }
  };
};
