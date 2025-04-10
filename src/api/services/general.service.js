const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { sqlGroupStandings } = require('../../lib/queries');
const { jsonToCsv } = require('../../lib/utils');

module.exports = (db) => {
  const { select } = dbHelper(db);
  const winAward = 3;

  return {
    listPitches: async (tournamentId) => {
      const pitchEvents = await select(
        `SELECT * FROM v_pitch_events WHERE tournamentId = ?`,
        [tournamentId]
      );
      if (pitchEvents.length) return pitchEvents;
      return await select(
        `SELECT * FROM pitches WHERE tournamentId = ?`,
        [tournamentId]
      );
    },

    listStandings: async (tournamentId, category) => {
      const extra = category ? ` AND category = ?` : "";
      const params = category ? [tournamentId, category] : [tournamentId];
      const [groups, standings] = await Promise.all([
        select(
          `SELECT DISTINCT category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`,
          params
        ),
        select(
          `SELECT * FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`,
          params
        )
      ]);
      return { 
        groups: groups.map(g => g.category), 
        data: standings 
      };
    }
  };
};
