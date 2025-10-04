const dbHelper = require('../../lib/db-helper');
const { sqlGroupStandings } = require('../../lib/queries');

module.exports = (db) => {
  const { select } = dbHelper(db);
  const winAward = 3;

  return {
    /*
     * List teams for a given tournament, category, stage, and group number.
     * @param {string} tournamentId - The ID of the tournament.
     * @param {string} category - The category of the teams.
     * @param {string} stage - can be "group", "playoffs", "knockout"
     * @param {number} group -
     *    For "group", this will be a number.
     *    For "playoffs", this will be 0.
     *    For "knockout", this will be one of "cup", "shield", "plate", "bowl", "spoon".
     * @returns {Promise<Array>} - A promise that resolves to an array of teams.
     */
    listTeams: async (tournamentId, category, stage, group) => {
      // normalize knockout group names
      let normGroup = group;
      if (stage === 'knockout' && typeof normGroup === 'string') {
        switch (normGroup.toLowerCase()) {
          case 'shield':
          case 'sld':
            normGroup = 'shd';
            break;
          case 'plate':
            normGroup = 'plt';
            break;
          case 'bowl':
            normGroup = 'bwl';
            break;
          case 'spoon':
            normGroup = 'spn';
            break;
          default:
            break;
        }
      }
      // build dynamic WHERE clause
      const conditions = ['tournamentId = ?'];
      const params = [tournamentId];
      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }
      if (stage === 'group') {
        conditions.push('stage = ?');
        params.push(stage);
        if (group != null) {
          conditions.push('groupNumber = ?');
          params.push(group);
        }
      } else if (stage === 'knockout') {
        conditions.push('stage LIKE ?');
        params.push(`${normGroup}%`);
      } else {
        conditions.push('stage = ?');
        params.push(stage);
      }
      const where = conditions.join(' AND ');
      const sql = `
        SELECT DISTINCT team FROM (
          SELECT team1Id as team FROM fixtures WHERE ${where}
          UNION
          SELECT team2Id as team FROM fixtures WHERE ${where}
        ) teams
      `;
      console.log('paarms', params);
      const teams = await select(sql, [...params, ...params]);
      return teams.map((t) => t.team).sort();
    },

    listPitches: async (tournamentId) => {
      const pitchEvents = await select(
        `SELECT DISTINCT * FROM v_pitch_events WHERE tournamentId = ?`,
        [tournamentId]
      );
      if (pitchEvents.length) return pitchEvents;
      return await select(
        `SELECT MAX(id) AS id, pitch, location FROM pitches WHERE tournamentId = ? GROUP BY pitch, location`,
        [tournamentId]
      );
    },

    listStandings: async (tournamentId, category) => {
      const extra = category ? ` AND category = ?` : '';
      const params = category ? [tournamentId, category] : [tournamentId];
      const [groups, standings] = await Promise.all([
        select(
          `SELECT DISTINCT category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`,
          params
        ),
        select(
          `SELECT * FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`,
          params
        ),
      ]);
      return {
        groups: groups.map((g) => g.category),
        data: standings,
      };
    },

    getUsers: async (filter) => {
      let query = `SELECT id as userId, Name as name FROM sec_users WHERE IsActive = 1`;
      let params = [];
      if (filter && filter.length >= 2) {
        query += ` AND LOWER(Name) LIKE LOWER(?)`;
        params.push(`%${filter}%`);
      }
      const users = await select(query, params);
      return users;
    },
  };
};
