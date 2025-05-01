const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { calculateRankings, sqlGroupStandings } = require('../../lib/queries');
const { mysqlCurrentTime } = require('../../lib/utils');

module.exports = (db) => {
  const { select, insert, update, transaction, query } = dbHelper(db);
  const winAward = 3;

  async function processStageCompletion(fixtureId) {
    DD(`Processing stage completion for fixture [${fixtureId}]`);
    const [fixture] = await select(
      `SELECT tournamentId, stage, groupNumber, category FROM fixtures WHERE id = ?`,
      [fixtureId]
    );
    if (!fixture) return false;

    const [remaining] = await select(
      `SELECT count(*) as remaining FROM fixtures 
       WHERE tournamentId = ? AND stage = ? AND groupNumber = ? AND category = ? AND goals1 is null`,
      [fixture.tournamentId, fixture.stage, fixture.groupNumber, fixture.category]
    );

    if (remaining.remaining === 0) {
      DD(`Stage [${fixture.stage}] completed - updating calculated teams`);
      const groupStandings = await select(
        `SELECT * FROM ${sqlGroupStandings(winAward)} 
         WHERE tournamentId = ? AND grp = ? AND category = ?`,
        [fixture.tournamentId, fixture.groupNumber, fixture.category]
      );

      const numPositions = fixture.stage === "group" 
        ? (await select(
            `SELECT count(*) as numPositions FROM v_fixture_information 
             WHERE tournamentId = ? AND stage = ? AND groupNumber = ? AND category = ?`,
            [fixture.tournamentId, fixture.stage, fixture.groupNumber, fixture.category]
          ))[0].numPositions || 0
        : 2;

      let totalUpdated = 0;
      for (let position = 0; position < numPositions; position++) {
        const placeHolder = `~${fixture.stage}:${fixture.groupNumber}/p:${position + 1}`;
        const newValue = groupStandings[position]?.team;
        
        const updateTeam = async (teamField) => {
          const result = await update(
            `UPDATE fixtures SET ${teamField}Id = ? 
             WHERE ${teamField}Planned = ? AND tournamentId = ? AND category = ?`,
            [newValue, placeHolder, fixture.tournamentId, fixture.category]
          );
          return result.affectedRows;
        };


        totalUpdated += 
          await updateTeam("team1") + 
          await updateTeam("team2") + 
          await updateTeam("umpireTeam");
      }

      DD(`Updated ${totalUpdated} fixtures for completed stage`);
      return true;
    }
    DD(`Stage has ${remaining.remaining} remaining matches`);
    return false;
  }

  return {
    getFixture: async (tournamentId, fixtureId) => {
      const [fixture] = await select(
        `SELECT * FROM fixtures WHERE id = ? and tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      return embellishFixture(fixture);
    },

    getFixturesByPitch: async (tournamentId, pitch) => {
      const where = pitch 
        ? `WHERE tournamentId = ? AND pitch = ?`
        : `WHERE tournamentId = ?`;
      return (await select(
        `SELECT * FROM v_fixture_information ${where}`,
        pitch ? [tournamentId, pitch] : [tournamentId]
      )).map(embellishFixture);
    },

    getNextFixtures: async (tournamentId) => {
      return await select(`
        WITH RankedFixtures AS (
            SELECT 
                vfi.tournamentId, vfi.category, vfi.pitch,
                vfi.scheduledTime, vfi.startedTime,
                vfi.groupNumber AS grp, vfi.team1, vfi.team2, vfi.umpireTeam, 
                vfi.goals1, vfi.points1, vfi.goals2, vfi.points2, 
                vfi.id AS matchId,
                'ranked' AS isType,
                ROW_NUMBER() OVER (
                    PARTITION BY vfi.category 
                    ORDER BY vfi.scheduledTime
                ) AS rn
            FROM v_fixture_information vfi
            WHERE vfi.tournamentId = ? AND vfi.played = 0
        ),
        RecentPlayedFixtures AS (
            SELECT 
                vfi.tournamentId, vfi.category, vfi.pitch,
                vfi.scheduledTime, vfi.startedTime,
                vfi.groupNumber AS grp, vfi.team1, vfi.team2, vfi.umpireTeam, 
                vfi.goals1, vfi.points1, vfi.goals2, vfi.points2, 
                vfi.id AS matchId,
                'recent' AS isType,
                ROW_NUMBER() OVER (
                    PARTITION BY vfi.category 
                    ORDER BY vfi.startedTime DESC
                ) AS rn
            FROM v_fixture_information vfi
            WHERE vfi.tournamentId = ? AND vfi.played = 1
        )
        SELECT * FROM RankedFixtures WHERE rn <= 3
        UNION ALL
        SELECT * FROM RecentPlayedFixtures WHERE rn = 1
        ORDER BY scheduledTime, matchId`,
        [tournamentId, tournamentId]
      );
    },

    rewindLatestFixture: async (tournamentId) => {
      const [latest] = await select(
        `SELECT id, category, stage FROM fixtures 
         WHERE tournamentId = ? AND started IS NOT NULL 
         ORDER BY started DESC LIMIT 1`,
        [tournamentId]
      );
      if (!latest) return null;
      
      await update(
        `UPDATE fixtures 
         SET goals1 = NULL, points1 = NULL, goals2 = NULL, points2 = NULL, started = NULL 
         WHERE id = ?`,
        [latest.id]
      );
      return latest;
    },

    startFixture: async (fixtureId) => {
      const timestamp = mysqlCurrentTime();
      await update(
        `UPDATE fixtures SET started = ? WHERE id = ?`,
        [timestamp, fixtureId]
      );
      return { started: timestamp };
    },

    updateScore: async (tournamentId, fixtureId, team1, team2, outcome) => {
      const timestamp = mysqlCurrentTime();
      await update(
        `UPDATE fixtures 
         SET goals1 = ?, points1 = ?, goals2 = ?, points2 = ?, outcome = ?, ended = ?  
         WHERE id = ?`,
        [team1.goals, team1.points, team2.goals, team2.points, outcome, timestamp, fixtureId]
      );

      // Retrieve fixture details to get the category used for updates.
      const [fixture] = await select(
        `SELECT tournamentId, category FROM fixtures WHERE id = ?`,
        [fixtureId]
      );
      if (fixture) {
        const { category } = fixture;
        // Decide winner and loser based on goals (adjust logic for draws as needed).
        const winner = team1.goals > team2.goals ? team1.name : team2.name;
        const loser  = team1.goals > team2.goals ? team2.name : team1.name;
    
        // Update all references for the winning team.
        await update(
          `UPDATE fixtures SET team1Id = ? WHERE team1Planned = ? AND tournamentId = ? AND category = ?`,
          [winner, `~match:${fixtureId}/p:1`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET team2Id = ? WHERE team2Planned = ? AND tournamentId = ? AND category = ?`,
          [winner, `~match:${fixtureId}/p:1`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET umpireTeamId = ? WHERE umpireTeamPlanned = ? AND tournamentId`,
          [winner, `~match:${fixtureId}/p:1`, tournamentId, category]
        );
    
        // Update all references for the losing team.
        await update(
          `UPDATE fixtures SET team1Id = ? WHERE team1Planned = ? AND tournamentId = ? AND category = ?`,
          [loser, `~match:${fixtureId}/p:2`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET team2Id = ? WHERE team2Planned = ? AND tournamentId = ? AND category = ?`,
          [loser, `~match:${fixtureId}/p:2`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET umpireTeamId = ? WHERE umpireTeamPlanned = ? AND tournamentId`,
          [loser, `~match:${fixtureId}/p:2`, tournamentId, category]
        );
     }
      await processStageCompletion(fixtureId);
      return { updated: true };
    },

    cardPlayers: async (tournamentId, fixtureId, cards) => {
      const values = cards.map(c => [tournamentId, fixtureId, c.playerId, c.cardColor]);
      await insert(
        `INSERT INTO cards (tournamentId, fixtureId, playerId, cardColor) VALUES ?`,
        [values]
      );
      return { cardsAdded: cards.length };
    },

    getCardedPlayers: async (tournamentId) => {
      return await select(
        `SELECT c.playerId, p.firstName, p.secondName, c.team, c.cardColor 
         FROM cards c JOIN players p ON c.playerId = p.id 
         WHERE c.tournamentId = ? 
         ORDER BY c.team, p.firstName`,
        [tournamentId]
      );
    },

    reschedule: async ({ tournamentId, fixtureId, relativeFixtureId, placement, targetPitch }) => {
      const [relFixture] = await select(
        `SELECT scheduled, pitch FROM fixtures 
         WHERE id = ? AND tournamentId = ?`,
        [relativeFixtureId, tournamentId]
      );
      if (!relFixture) throw new Error(`Relative fixture ${relativeFixtureId} not found`);

      const relDate = new Date(relFixture.scheduled);
      relDate.setMinutes(relDate.getMinutes() + (placement === 'before' ? -5 : 5));
      const newScheduled = relDate.toISOString().slice(0, 19).replace("T", " ");
      const pitch = targetPitch || relFixture.pitch;

      await update(
        `UPDATE fixtures SET scheduled = ?, pitch = ? 
         WHERE id = ? AND tournamentId = ?`,
        [newScheduled, pitch, fixtureId, tournamentId]
      );
      return { fixtureId, newScheduled, pitch };
    }
  };
};


function embellishFixture(fixture) {
  return {
    ...fixture,
    isResult: !!(fixture?.goals1 === 0 || fixture?.goals1)
  }
}
