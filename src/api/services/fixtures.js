const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');
const { calculateRankings } = require('../../lib/queries');
const { mysqlCurrentTime } = require('../../lib/utils');

const stageCompletion = require('./fixtures/stage-completion');

module.exports = (db) => {
  // Destructure 'delete' from dbHelper as well
  const { select, insert, update, transaction, query, delete: dbDelete } = dbHelper(db);
  // Instantiate stage completion processor with necessary dependencies
  const loggers = { II, DD };
  // Pass dbDelete to dbHelpers if stageCompletion needs it, otherwise it's available in this scope
  const dbHelpers = { select, insert, update, transaction, query };
  // Assuming sqlGroupStandings is needed and imported/available
  const { sqlGroupStandings } = require('../../lib/queries'); // Make sure this is imported if not already
  const stageCompletionProcessor = stageCompletion({ dbHelpers, loggers, sqlGroupStandings });

  // Define embellishFixture inside the factory to access 'select'
  async function embellishFixture(fixture, options = {}) {
    if (!fixture) return null; // Handle null fixture input
    const embellished = {
      ...fixture,
      // todo: get rid v_fixture_information. Centralize abstractions in the code.
      team1: fixture.team1Id || fixture.team1,
      team2: fixture.team2Id || fixture.team2,
      umpireTeam: fixture.umpireTeamId|| fixture.umpireTeam,
      scheduledTime: fixture.scheduled
        ? `${fixture.scheduled.toISOString()}`?.split('T').pop().substring(0, 5)
        : null,
      startedTime: fixture.started 
        ? `${fixture.started.toISOString()}`?.split('T').pop().substring(0, 5)
        : null,
      isResult: !!(fixture.goals1 === 0 || fixture.goals1),
      played: fixture.outcome != 'not played' && fixture.ended
    };

    if (options.cardedPlayers && fixture.id && fixture.tournamentId) {
      DD(`Embellishing fixture [${fixture.id}] with card data.`);
      embellished.cardedPlayers = await select(
        `SELECT * FROM cards WHERE tournamentId = ? AND fixtureId = ?`,
        [fixture.tournamentId, fixture.id]
      );
      DD(`Found ${embellished.cardedPlayers.length} cards for fixture [${fixture.id}].`);
    } else if (options.cardedPlayers) {
        DD(`Card embellishment requested but fixture ID or tournament ID missing for fixture: ${JSON.stringify(fixture)}`);
        embellished.cardedPlayers = []; // Add empty array if requested but IDs missing
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
      return await embellishFixture(fixture, {cardedPlayers: true});
    },

    getFixturesByPitch: async (tournamentId, pitch) => {
      const where = pitch
        ? `WHERE tournamentId = ? AND pitch = ?`
        : `WHERE tournamentId = ?`;
      const fixtures = await select( // Assign result to 'fixtures'
        `SELECT * FROM fixtures ${where}`,
        pitch ? [tournamentId, pitch] : [tournamentId]
      ); // Removed semicolon
      // Embellish each fixture; use Promise.all for async mapping
      return await Promise.all(fixtures.map(f => embellishFixture(f))); // Defaulting to no cards
    },

    getNextFixtures: async (tournamentId) => {
      return await select(`
        WITH RankedFixtures AS (
            SELECT 
                vfi.tournamentId, vfi.category, vfi.pitch,
                vfi.scheduledTime, 
                vfi.started,
                vfi.ended,
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
                vfi.scheduledTime,
                vfi.started,
                vfi.ended,
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

    endFixture: async (fixtureId) => {
      console.log('ok')
      const timestamp = mysqlCurrentTime();
      await update(
        `UPDATE fixtures SET ended = ? WHERE id = ?`,
        [timestamp, fixtureId]
      );
      return { started: timestamp };
    },

    updateScore: async (tournamentId, fixtureId, team1, team2, outcome) => {
      await update(
        `UPDATE fixtures 
         SET goals1 = ?, points1 = ?, goals2 = ?, points2 = ?, outcome = ?
         WHERE id = ?`,
        [team1.goals, team1.points, team2.goals, team2.points, outcome, fixtureId]
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

    // This function handles adding (if id is null) or updating (if id exists) a card record.
    cardPlayers: async (tournamentId, fixtureId, cardData) => {
      // cardData contains: id (card primary key, nullable), cardColor, team, playerNumber, playerName
      const { id, cardColor, team, playerNumber, playerName } = cardData; // Destructure new fields
      DD(`Processing card for tournament [${tournamentId}], fixture [${fixtureId}], card ID [${id || 'NEW'}]`);

      if (id) {
        // UPDATE existing card record based on its primary key 'id'
        DD(`Updating existing card record with ID [${id}]`);
        // Update all relevant fields passed from the client
        await update(
          `UPDATE cards SET cardColor = ?, team = ?, playerNumber = ?, playerName = ? WHERE id = ?`,
          [cardColor, team, playerNumber, playerName, id] // Add new fields to update
        );
        return { cardUpdated: true, cardId: id };
      } else {
        // INSERT new card record. Ignore playerId column.
        DD(`Inserting new card record for fixture [${fixtureId}]`);
        // Ensure your 'cards' table allows INSERT without playerId or has a default.
        // Include playerNumber and playerName in the INSERT statement.
        const insertId = await insert(
          `INSERT INTO cards (tournamentId, fixtureId, cardColor, team, playerNumber, playerName) VALUES (?, ?, ?, ?, ?, ?)`,
          [tournamentId, fixtureId, cardColor, team, playerNumber, playerName] // Add new fields to insert
        );
        return { cardAdded: true, cardId: insertId };
      }
    },

    deleteCard: async (tournamentId, fixtureId, cardId) => {
      DD(`Deleting card record with ID [${cardId}] for tournament [${tournamentId}], fixture [${fixtureId}]`);
      // Use the destructured 'dbDelete' function
      const affectedRows = await dbDelete(
        `DELETE FROM cards WHERE id = ? AND tournamentId = ? AND fixtureId = ?`,
        [cardId, tournamentId, fixtureId]
      );

      if (affectedRows > 0) {
        DD(`Successfully deleted card record with ID [${cardId}]. Affected rows: ${affectedRows}`);
        return { cardDeleted: true };
      } else {
        DD(`Card record with ID [${cardId}] not found or not associated with tournament [${tournamentId}] / fixture [${fixtureId}]. Affected rows: ${affectedRows}`);
        return { cardDeleted: false }; // Indicate deletion failed (likely not found)
      }
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
