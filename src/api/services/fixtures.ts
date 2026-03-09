import dbHelper from '../../lib/db-helper';
import { mysqlCurrentTime } from '../../lib/utils';
import stageCompletionFactory from './fixtures/stage-completion';
import enhanceFixtureFactory from './fixtures/enhance-fixture';
import TSVValidator from './fixtures/validate-tsv';
import { II, DD } from '../../lib/logging';
import { sqlGroupStandings, sqlGroupRankings } from '../../lib/queries';

export interface TeamScore {
  goals: number;
  points: number;
  goalsExtra?: number | null;
  pointsExtra?: number | null;
  goalsPenalties?: number | null;
  name?: string;
}

export interface CardData {
  id?: number;
  cardColor: string;
  team: string;
  playerNumber: string;
  playerName: string;
}

export interface RescheduleInput {
  tournamentId: number;
  fixtureId: number;
  relativeFixtureId: number;
  placement?: 'before' | 'after';
  targetPitch?: string;
  action: 'swapTime' | 'move';
}

export interface RescheduleResult {
  fixtureId: number;
  relativeFixtureId?: number;
  action: string;
  newScheduled?: string;
  relativeNewScheduled?: string;
  pitch?: string;
}

export default function fixturesService(db: any) {
  const {
    select,
    insert,
    update,
    transaction,
    delete: dbDelete,
  } = dbHelper(db);

  const loggers = { II, DD };
  const dbHelpers = { select, insert, update, transaction };

  let stageCompletionProcessor: ReturnType<
    typeof stageCompletionFactory
  > | null;
  try {
    stageCompletionProcessor = stageCompletionFactory({
      dbHelpers,
      loggers,
      sqlGroupStandings,
      sqlGroupRankings,
    });
  } catch (error) {
    console.error('Error creating stageCompletionProcessor:', error);
    stageCompletionProcessor = null;
  }

  const fixtureEnhancer = enhanceFixtureFactory({
    dbHelpers: { select },
    loggers: { DD },
  });
  const { embellishFixture, getOrCalculateTournamentCategoryCompositions } =
    fixtureEnhancer;

  return {
    validateTsv: (tsvEncoded: string) =>
      new TSVValidator(tsvEncoded, { restGapMultiplier: 1 }).validate(),

    getFixture: async (tournamentId: number, fixtureId: number) => {
      const [fixture] = await select(
        `SELECT * FROM fixtures WHERE id = ? and tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      const categoryCompositions =
        await getOrCalculateTournamentCategoryCompositions(tournamentId);
      return await embellishFixture(
        fixture as any,
        { cardedPlayers: true },
        categoryCompositions
      );
    },

    getFixtures: async (
      tournamentId: number,
      {
        pitch,
        category,
        outcome,
        order = 'id',
      }: {
        pitch?: string;
        category?: string;
        outcome?: string;
        order?: string;
      }
    ) => {
      const conditions: string[] = ['tournamentId = ?'];
      const params: any[] = [tournamentId];

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
          .sort(
            (a: any, b: any) =>
              new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime()
          )
          .map((f: any) => embellishFixture(f, {}, categoryCompositions))
      );
    },

    getFilteredFixtures: async (
      tournamentId: number,
      {
        pitch = [],
        category = [],
        referee,
        team,
        order = 'id',
      }: {
        pitch?: string[];
        category?: string[];
        referee?: string;
        team?: string;
        order?: string;
      }
    ) => {
      const conditions: string[] = ['tournamentId = ?'];
      const params: any[] = [tournamentId];

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

      if (
        typeof referee === 'string' &&
        referee.trim() !== '' &&
        referee !== '*'
      ) {
        conditions.push(`LOWER(referee) = ?`);
        params.push(referee.toLowerCase());
      }

      if (typeof team === 'string' && team.trim() !== '' && team !== '*') {
        conditions.push(`(LOWER(team1Id) = ? OR LOWER(team2Id) = ?)`);
        params.push(team.toLowerCase(), team.toLowerCase());
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const fixtures = await select(
        `SELECT * FROM fixtures ${where} ORDER BY ${order}`,
        params
      );

      const categoryCompositions =
        await getOrCalculateTournamentCategoryCompositions(tournamentId);
      const results = await Promise.all(
        fixtures
          .sort(
            (a: any, b: any) =>
              new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime()
          )
          .map((f: any) => embellishFixture(f, {}, categoryCompositions))
      );
      return results || [];
    },

    getNextFixtures: async (tournamentId: number) => {
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

    rewindLatestFixture: async (tournamentId: number) => {
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

    startFixture: async (fixtureId: number) => {
      const timestamp = mysqlCurrentTime();
      await update(`UPDATE fixtures SET started = ? WHERE id = ?`, [
        timestamp,
        fixtureId,
      ]);
      return { started: timestamp };
    },

    endFixture: async (fixtureId: number) => {
      console.log('ok');
      const timestamp = mysqlCurrentTime();
      await update(`UPDATE fixtures SET ended = ? WHERE id = ?`, [
        timestamp,
        fixtureId,
      ]);
      return { started: timestamp };
    },

    updateScore: async (
      tournamentId: number,
      fixtureId: number,
      team1: TeamScore,
      team2: TeamScore,
      outcome: string
    ) => {
      await update(
        `UPDATE fixtures 
         SET goals1 = ?, points1 = ?, goals1Extra = ?, points1Extra = ?, goals1Penalties = ?,
             goals2 = ?, points2 = ?, goals2Extra = ?, points2Extra = ?, goals2Penalties = ?,
             outcome = ?
         WHERE id = ?`,
        [
          team1.goals,
          team1.points,
          team1.goalsExtra ?? null,
          team1.pointsExtra ?? null,
          team1.goalsPenalties ?? null,
          team2.goals,
          team2.points,
          team2.goalsExtra ?? null,
          team2.pointsExtra ?? null,
          team2.goalsPenalties ?? null,
          outcome,
          fixtureId,
        ]
      );

      const [fixture] = await select(
        `SELECT tournamentId, category FROM fixtures WHERE id = ?`,
        [fixtureId]
      );
      if (fixture) {
        const { category } = fixture;
        const scoreValue = (team: TeamScore) =>
          (Number(team?.goals) || 0) * 3 + (Number(team?.points) || 0);
        const team1Aggregate = scoreValue(team1);
        const team2Aggregate = scoreValue(team2);

        let winner = team1.name;
        let loser = team2.name;

        if (team1Aggregate < team2Aggregate) {
          winner = team2.name;
          loser = team1.name;
        }

        await update(
          `UPDATE fixtures SET team1Id = ? WHERE team1Planned = ? AND tournamentId = ? AND category = ?`,
          [winner, `~match:${fixtureId}/p:1`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET team2Id = ? WHERE team2Planned = ? AND tournamentId = ? AND category = ?`,
          [winner, `~match:${fixtureId}/p:1`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET umpireTeamId = ? WHERE umpireTeamPlanned = ? AND tournamentId = ? AND category = ?`,
          [winner, `~match:${fixtureId}/p:1`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET team1Id = ? WHERE team1Planned = ? AND tournamentId = ? AND category = ?`,
          [loser, `~match:${fixtureId}/p:2`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET team2Id = ? WHERE team2Planned = ? AND tournamentId = ? AND category = ?`,
          [loser, `~match:${fixtureId}/p:2`, tournamentId, category]
        );
        await update(
          `UPDATE fixtures SET umpireTeamId = ? WHERE umpireTeamPlanned = ? AND tournamentId = ? AND category = ?`,
          [loser, `~match:${fixtureId}/p:2`, tournamentId, category]
        );
      }
      if (stageCompletionProcessor?.processStageCompletion) {
        await stageCompletionProcessor.processStageCompletion(fixtureId);
      }
      return { updated: true };
    },

    cardPlayers: async (
      tournamentId: number,
      fixtureId: number,
      cardData: CardData
    ) => {
      const { id, cardColor, team, playerNumber, playerName } = cardData;
      DD(
        `Processing card for tournament [${tournamentId}], fixture [${fixtureId}], card ID [${id || 'NEW'}]`
      );

      if (id) {
        DD(`Updating existing card record with ID [${id}]`);
        await update(
          `UPDATE cards SET cardColor = ?, team = ?, playerNumber = ?, playerName = ? WHERE id = ?`,
          [cardColor, team, playerNumber, playerName, id]
        );
        return { cardUpdated: true, cardId: id };
      } else {
        DD(`Inserting new card record for fixture [${fixtureId}]`);
        const insertId = await insert(
          `INSERT INTO cards (tournamentId, fixtureId, cardColor, team, playerNumber, playerName) VALUES (?, ?, ?, ?, ?, ?)`,
          [tournamentId, fixtureId, cardColor, team, playerNumber, playerName]
        );
        return { cardAdded: true, cardId: insertId };
      }
    },

    deleteCard: async (
      tournamentId: number,
      fixtureId: number,
      cardId: number
    ) => {
      DD(
        `Deleting card record with ID [${cardId}] for tournament [${tournamentId}], fixture [${fixtureId}]`
      );
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
        return { cardDeleted: false };
      }
    },

    getCardedPlayers: async (tournamentId: number) => {
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
    }: RescheduleInput): Promise<RescheduleResult> => {
      if (action === 'swapTime') {
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
        const fixture1 = fixtures.find((f: any) => f.id == fixtureId);
        const fixture2 = fixtures.find((f: any) => f.id == relativeFixtureId);

        if (fixture1.pitch !== fixture2.pitch) {
          throw new Error(
            `Cannot swap times: fixtures must be on the same pitch`
          );
        }

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
          newScheduled: String(fixture2.scheduled),
          relativeNewScheduled: String(fixture1.scheduled),
        };
      } else {
        const [relFixture] = await select(
          `SELECT scheduled, pitch FROM fixtures
           WHERE id = ? AND tournamentId = ?`,
          [relativeFixtureId, tournamentId]
        );
        if (!relFixture)
          throw new Error(`Relative fixture ${relativeFixtureId} not found`);

        const relDate = new Date(String(relFixture.scheduled));
        relDate.setMinutes(
          relDate.getMinutes() + (placement === 'before' ? -5 : 5)
        );
        const newScheduled = relDate
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');
        const pitch = targetPitch || String(relFixture.pitch);

        await update(
          `UPDATE fixtures SET scheduled = ?, pitch = ?
           WHERE id = ? AND tournamentId = ?`,
          [newScheduled, pitch, fixtureId, tournamentId]
        );
        return { fixtureId, action: 'move', newScheduled, pitch };
      }
    },
  };
}
