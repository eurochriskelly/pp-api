const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { calculateRankings } = require('../../lib/queries');
const { mysqlCurrentTime } = require('../../lib/utils');
const stageCompletion = require('../controllers/fixtures/stage-completion');

module.exports = (db) => {
  const { select, insert, update, transaction, query } = dbHelper(db);
  // Instantiate stage completion processor with necessary dependencies
  const loggers = { II, DD };
  const dbHelpers = { select, insert, update, transaction, query };
  // Assuming sqlGroupStandings is needed and imported/available
  const { sqlGroupStandings } = require('../../lib/queries'); // Make sure this is imported if not already
  const stageCompletionProcessor = stageCompletion({ dbHelpers, loggers, sqlGroupStandings });


  // Define embellishFixture inside the factory to access 'select'
  async function embellishFixture(fixture, options = {}) {
    if (!fixture) return null; // Handle null fixture input

    const embellished = {
      ...fixture,
      isResult: !!(fixture.goals1 === 0 || fixture.goals1) // Use fixture directly
    };

    if (options.cards && fixture.id && fixture.tournamentId) {
      DD(`Embellishing fixture [${fixture.id}] with card data.`);
      embellished.cards = await select(
        `SELECT * FROM cards WHERE tournamentId = ? AND fixtureId = ?`,
        [fixture.tournamentId, fixture.id]
      );
      DD(`Found ${embellished.cards.length} cards for fixture [${fixture.id}].`);
    } else if (options.cards) {
        DD(`Card embellishment requested but fixture ID or tournament ID missing for fixture: ${JSON.stringify(fixture)}`);
        embellished.cards = []; // Add empty array if requested but IDs missing
    }

    return embellished;
  }


  return {
    getFixture: async (tournamentId, fixtureId) => {
      const [fixture] = await select(
        `SELECT * FROM fixtures WHERE id = ? and tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      // Pass options if needed, e.g., embellishFixture(fixture, { cards: true })
      // For now, defaulting to no cards
      return await embellishFixture(fixture);
    },

    getFixturesByPitch: async (tournamentId, pitch) => {
      const where = pitch 
        ? `WHERE tournamentId = ? AND pitch = ?`
        : `WHERE tournamentId = ?`;
      return (await select(
        `SELECT * FROM v_fixture_information ${where}`,
        pitch ? [tournamentId, pitch] : [tournamentId]
      );
      // Embellish each fixture; use Promise.all for async mapping
      return await Promise.all(fixtures.map(f => embellishFixture(f))); // Defaulting to no cards
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
      await stageCompletionProcessor.processStageCompletion(fixtureId);
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
    // Note: embellishFixture is now defined inside the factory function scope above
  };
};
