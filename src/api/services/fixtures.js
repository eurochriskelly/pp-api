const dbHelper = require('../../lib/db-helper');
const { mysqlCurrentTime } = require('../../lib/utils');
const stageCompletion = require('./fixtures/stage-completion');
const enhanceFixtureFactory = require('./fixtures/enhance-fixture');
const TSVValidator = require('./fixtures/validate-tsv');

const { II, DD } = require('../../lib/logging');

module.exports = (db) => {
  // Destructure 'delete' from dbHelper as well
  const {
    select,
    insert,
    update,
    transaction,
    query,
    delete: dbDelete,
  } = dbHelper(db);
  // Instantiate stage completion processor with necessary dependencies
  const loggers = { II, DD };
  // Pass dbDelete to dbHelpers if stageCompletion needs it, otherwise it's available in this scope
  const dbHelpers = { select, insert, update, transaction, query };
  // Assuming sqlGroupStandings is needed and imported/available
  const { sqlGroupStandings, sqlGroupRankings } = require('../../lib/queries'); // Make sure this is imported if not already
  console.log('sqlGroupStandings:', sqlGroupStandings);
  console.log('sqlGroupRankings:', sqlGroupRankings);
  console.log('loggers:', loggers);
  let stageCompletionProcessor;
  try {
    stageCompletionProcessor = stageCompletion({
      dbHelpers,
      loggers,
      sqlGroupStandings,
      sqlGroupRankings,
    });
    console.log(
      'stageCompletionProcessor created successfully:',
      stageCompletionProcessor
    );
  } catch (error) {
    console.error('Error creating stageCompletionProcessor:', error);
    stageCompletionProcessor = null;
  }
  console.log('stageCompletionProcessor:', stageCompletionProcessor);

  const fixtureEnhancer = enhanceFixtureFactory({
    dbHelpers: { select },
    loggers: { DD },
  });
  const { embellishFixture, getOrCalculateTournamentCategoryCompositions } =
    fixtureEnhancer;

  return {
    validateTsv: (tsvEncoded) =>
      new TSVValidator(tsvEncoded, { restGapMultiplier: 1 }).validate(),

    getFixture: async (tournamentId, fixtureId) => {
      const [fixture] = await select(
        `SELECT * FROM fixtures WHERE id = ? and tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      const categoryCompositions =
        await getOrCalculateTournamentCategoryCompositions(tournamentId);
      return await embellishFixture(
        fixture,
        { cardedPlayers: true },
        categoryCompositions
      );
    },

    getFixtures: async (
      tournamentId,
      { pitch, category, outcome, order = 'id' }
    ) => {
      const conditions = ['tournamentId = ?'];
      const params = [tournamentId];

      if (pitch && pitch !== '*') {
        conditions.push('pitch = ?');
        params.push(pitch);
      }
      if (category && category !== '*') {
        conditions.push('category = ?');
        params.push(category);
      }
      if (outcome && outcome !== '*') {
        conditions.push('outcome = ?');
        params.push(outcome);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const fixtures = await select(
        `SELECT * FROM fixtures ${where} ORDER BY ${order}`,
        params
      );

      const categoryCompositions =
        await getOrCalculateTournamentCategoryCompositions(tournamentId);
      return await Promise.all(
        fixtures
          .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled))
          .map((f) => embellishFixture(f, {}, categoryCompositions))
      );
    },

    getFilteredFixtures: async (
      tournamentId,
      {
        pitch = [],
        category = [],
        referee, // atomic string, optional
        team, // atomic string, optional
        order = 'id',
      }
    ) => {
      const conditions = ['tournamentId = ?'];
      const params = [tournamentId];

      // array filters: OR within, AND between
      if (Array.isArray(pitch) && pitch.length > 0) {
        const ph = pitch.map(() => '?').join(',');
        conditions.push(`LOWER(pitch) IN (${ph})`);
        params.push(...pitch.map((p) => p.toLowerCase()));
      }

      if (Array.isArray(category) && category.length > 0) {
        const ph = category.map(() => '?').join(',');
        conditions.push(`LOWER(category) IN (${ph})`);
        params.push(...category.map((c) => c.toLowerCase()));
      }

      // atomic filters: single value
      if (
        typeof referee === 'string' &&
        referee.trim() !== '' &&
        referee !== '*'
      ) {
        conditions.push(`LOWER(referee) = ?`);
        params.push(referee.toLowerCase());
      }

      if (typeof team === 'string' && team.trim() !== '' && team !== '*') {
        conditions.push(`LOWER(team) = ?`);
        params.push(team.toLowerCase());
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const fixtures = await select(
        `SELECT * FROM fixtures ${where} ORDER BY ${order}`,
        params
      );

      const categoryCompositions =
        await getOrCalculateTournamentCategoryCompositions(tournamentId);
      return await Promise.all(
        fixtures
          .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled))
          .map((f) => embellishFixture(f, {}, categoryCompositions))
      );
    },

    // Not called directly from route
    getNextFixtures: async (tournamentId) => {
      return await select(
        `
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
      await update(`UPDATE fixtures SET started = ? WHERE id = ?`, [
        timestamp,
        fixtureId,
      ]);
      return { started: timestamp };
    },

    endFixture: async (fixtureId) => {
      console.log('ok');
      const timestamp = mysqlCurrentTime();
      await update(`UPDATE fixtures SET ended = ? WHERE id = ?`, [
        timestamp,
        fixtureId,
      ]);
      return { started: timestamp };
    },

    updateScore: async (tournamentId, fixtureId, team1, team2, outcome) => {
      await update(
        `UPDATE fixtures 
         SET goals1 = ?, points1 = ?, goals2 = ?, points2 = ?, outcome = ?
         WHERE id = ?`,
        [
          team1.goals,
          team1.points,
          team2.goals,
          team2.points,
          outcome,
          fixtureId,
        ]
      );

      // Retrieve fixture details to get the category used for updates.
      const [fixture] = await select(
        `SELECT tournamentId, category FROM fixtures WHERE id = ?`,
        [fixtureId]
      );
      if (fixture) {
        const { category } = fixture;
        // Decide winner and loser using Gaelic scoring: 3 per goal, 1 per point.
        const scoreValue = (team) =>
          (Number(team?.goals) || 0) * 3 + (Number(team?.points) || 0);
        const team1Aggregate = scoreValue(team1);
        const team2Aggregate = scoreValue(team2);

        let winner = team1.name;
        let loser = team2.name;

        if (team1Aggregate < team2Aggregate) {
          winner = team2.name;
          loser = team1.name;
        }

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
      if (stageCompletionProcessor?.processStageCompletion) {
        await stageCompletionProcessor.processStageCompletion(fixtureId);
      }
      return { updated: true };
    },

    // This function handles adding (if id is null) or updating (if id exists) a card record.
    cardPlayers: async (tournamentId, fixtureId, cardData) => {
      // cardData contains: id (card primary key, nullable), cardColor, team, playerNumber, playerName
      const { id, cardColor, team, playerNumber, playerName } = cardData; // Destructure new fields
      DD(
        `Processing card for tournament [${tournamentId}], fixture [${fixtureId}], card ID [${id || 'NEW'}]`
      );

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
      DD(
        `Deleting card record with ID [${cardId}] for tournament [${tournamentId}], fixture [${fixtureId}]`
      );
      // Use the destructured 'dbDelete' function
      const affectedRows = await dbDelete(
        `DELETE FROM cards WHERE id = ? AND tournamentId = ? AND fixtureId = ?`,
        [cardId, tournamentId, fixtureId]
      );

      if (affectedRows > 0) {
        DD(
          `Successfully deleted card record with ID [${cardId}]. Affected rows: ${affectedRows}`
        );
        return { cardDeleted: true };
      } else {
        DD(
          `Card record with ID [${cardId}] not found or not associated with tournament [${tournamentId}] / fixture [${fixtureId}]. Affected rows: ${affectedRows}`
        );
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

    reschedule: async ({
      tournamentId,
      fixtureId,
      relativeFixtureId,
      placement,
      targetPitch,
      action,
    }) => {
      if (action === 'swapTime') {
        // Swap scheduled times between fixtureId and relativeFixtureId
        const fixtures = await select(
          `SELECT id, scheduled, pitch FROM fixtures
           WHERE id IN (?, ?) AND tournamentId = ?`,
          [fixtureId, relativeFixtureId, tournamentId]
        );
        if (fixtures.length !== 2) {
          throw new Error(
            `One or both fixtures not found or not in tournament`
          );
        }
        const fixture1 = fixtures.find((f) => f.id == fixtureId);
        const fixture2 = fixtures.find((f) => f.id == relativeFixtureId);

        // Ensure both fixtures are on the same pitch
        if (fixture1.pitch !== fixture2.pitch) {
          throw new Error(
            `Cannot swap times: fixtures must be on the same pitch`
          );
        }

        // Swap scheduled times
        await transaction(async () => {
          await update(
            `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
            [fixture2.scheduled, fixtureId, tournamentId]
          );
          await update(
            `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
            [fixture1.scheduled, relativeFixtureId, tournamentId]
          );
        });
        return {
          fixtureId,
          relativeFixtureId,
          action: 'swapTime',
          newScheduled: fixture2.scheduled,
          relativeNewScheduled: fixture1.scheduled,
        };
      } else {
        // Original reschedule logic
        const [relFixture] = await select(
          `SELECT scheduled, pitch FROM fixtures
           WHERE id = ? AND tournamentId = ?`,
          [relativeFixtureId, tournamentId]
        );
        if (!relFixture)
          throw new Error(`Relative fixture ${relativeFixtureId} not found`);

        const relDate = new Date(relFixture.scheduled);
        relDate.setMinutes(
          relDate.getMinutes() + (placement === 'before' ? -5 : 5)
        );
        const newScheduled = relDate
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');
        const pitch = targetPitch || relFixture.pitch;

        await update(
          `UPDATE fixtures SET scheduled = ?, pitch = ?
           WHERE id = ? AND tournamentId = ?`,
          [newScheduled, pitch, fixtureId, tournamentId]
        );
        return { fixtureId, newScheduled, pitch };
      }
    },
    // Note: embellishFixture is now defined inside the factory function scope above
  };
};
