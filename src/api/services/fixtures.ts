import dbHelper from '../../lib/db-helper';
import { mysqlCurrentTime } from '../../lib/utils';
import stageCompletionFactory from './fixtures/stage-completion';
import enhanceFixtureFactory from './fixtures/enhance-fixture';
import TSVValidator from './fixtures/validate-tsv';
import { II, DD } from '../../lib/logging';
import {
  sqlGroupStandings,
  sqlGroupStandingsWithH2H,
  sqlGroupRankings,
} from '../../lib/queries';
import { calculateAggregateMatchScore } from '../../lib/match-score';

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
  action: 'move';
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
      sqlGroupStandingsWithH2H,
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
      const [tournament] = await select(
        `SELECT id, status FROM tournaments WHERE id = ?`,
        [tournamentId]
      );
      if (!tournament) {
        const error = new Error('Tournament not found') as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'TOURNAMENT_NOT_FOUND';
        throw error;
      }

      const tournamentStatus = String(tournament.status || '').toLowerCase();
      const allowedStatuses = new Set(['in-design', 'new', 'published']);
      if (!allowedStatuses.has(tournamentStatus)) {
        const error = new Error(
          `Rewind is only available before the tournament starts. Current status is '${tournament.status}'.`
        ) as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 409;
        error.code = 'TOURNAMENT_STATUS_INVALID_FOR_REWIND';
        throw error;
      }

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
        `SELECT tournamentId, category, team1Id, team2Id FROM fixtures WHERE id = ?`,
        [fixtureId]
      );
      if (fixture) {
        const category = String(fixture.category || '');
        const team1Id = fixture.team1Id ? String(fixture.team1Id) : null;
        const team2Id = fixture.team2Id ? String(fixture.team2Id) : null;
        const team1Aggregate = calculateAggregateMatchScore(team1);
        const team2Aggregate = calculateAggregateMatchScore(team2);

        let winner: string | null = null;
        let loser: string | null = null;

        if (team1Aggregate > team2Aggregate) {
          winner = team1Id;
          loser = team2Id;
        } else if (team1Aggregate < team2Aggregate) {
          winner = team2Id;
          loser = team1Id;
        }

        const syncMatchPlaceholder = async (
          plannedField: 'team1Planned' | 'team2Planned' | 'umpireTeamPlanned',
          idField: 'team1Id' | 'team2Id' | 'umpireTeamId',
          placeholder: string,
          value: string | null
        ) => {
          await update(
            `UPDATE fixtures SET ${idField} = ? WHERE ${plannedField} = ? AND tournamentId = ? AND category = ?`,
            [value, placeholder, tournamentId, category]
          );
        };

        await syncMatchPlaceholder(
          'team1Planned',
          'team1Id',
          `~match:${fixtureId}/p:1`,
          winner
        );
        await syncMatchPlaceholder(
          'team2Planned',
          'team2Id',
          `~match:${fixtureId}/p:1`,
          winner
        );
        await syncMatchPlaceholder(
          'umpireTeamPlanned',
          'umpireTeamId',
          `~match:${fixtureId}/p:1`,
          winner
        );
        await syncMatchPlaceholder(
          'team1Planned',
          'team1Id',
          `~match:${fixtureId}/p:2`,
          loser
        );
        await syncMatchPlaceholder(
          'team2Planned',
          'team2Id',
          `~match:${fixtureId}/p:2`,
          loser
        );
        await syncMatchPlaceholder(
          'umpireTeamPlanned',
          'umpireTeamId',
          `~match:${fixtureId}/p:2`,
          loser
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

    getCardedPlayers: async (tournamentId: number, fixtureId?: number) => {
      const hasFixtureFilter =
        fixtureId !== undefined && fixtureId !== null && !isNaN(fixtureId);
      return await select(
        `SELECT c.id, c.fixtureId, c.playerId, p.firstName, p.secondName, c.team, c.cardColor, c.playerNumber, c.playerName
         FROM cards c JOIN players p ON c.playerId = p.id 
         WHERE c.tournamentId = ?${hasFixtureFilter ? ' AND c.fixtureId = ?' : ''}
         ORDER BY c.team, p.firstName`,
        hasFixtureFilter ? [tournamentId, fixtureId] : [tournamentId]
      );
    },

    reschedule: async ({
      tournamentId,
      fixtureId,
      relativeFixtureId,
      placement,
      targetPitch,
    }: RescheduleInput): Promise<RescheduleResult> => {
      // 1. Load fixture to move
      const [fixtureToMove] = await select(
        `SELECT id, scheduled, pitch, durationPlanned FROM fixtures
         WHERE id = ? AND tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      if (!fixtureToMove) {
        const error = new Error(`Fixture ${fixtureId} not found`) as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'FIXTURE_NOT_FOUND';
        throw error;
      }

      // 2. Load target fixture
      const [targetFixture] = await select(
        `SELECT id, scheduled, pitch, durationPlanned FROM fixtures
         WHERE id = ? AND tournamentId = ?`,
        [relativeFixtureId, tournamentId]
      );
      if (!targetFixture) {
        const error = new Error(
          `Target fixture ${relativeFixtureId} not found`
        ) as Error & { statusCode?: number; code?: string };
        error.statusCode = 404;
        error.code = 'TARGET_NOT_FOUND';
        throw error;
      }

      const sourcePitch: string = String(fixtureToMove.pitch);
      const destPitch: string = targetPitch || String(targetFixture.pitch);

      if (sourcePitch === destPitch) {
        // SAME PITCH: Rotate time slots
        const fixtures = await select(
          `SELECT id, scheduled, durationPlanned FROM fixtures
           WHERE tournamentId = ? AND pitch = ?
           ORDER BY scheduled ASC, id ASC`,
          [tournamentId, sourcePitch]
        );

        // Save original time slots
        const timeSlots = fixtures.map((f: any) => f.scheduled);

        // Find and remove moved fixture
        const movedIndex = fixtures.findIndex((f: any) => f.id === fixtureId);
        fixtures.splice(movedIndex, 1);

        // Find target position
        const targetIndex = fixtures.findIndex(
          (f: any) => f.id === relativeFixtureId
        );
        const insertIndex =
          placement === 'after' ? targetIndex + 1 : targetIndex;

        // Insert moved fixture at new position
        fixtures.splice(insertIndex, 0, fixtureToMove);

        // Assign saved time slots to fixtures by position
        await transaction(async (tx) => {
          for (let i = 0; i < fixtures.length; i++) {
            await tx.update(
              `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
              [timeSlots[i], fixtures[i].id, tournamentId]
            );
          }
        });

        const movedFixture = fixtures.find((f: any) => f.id === fixtureId);
        return {
          fixtureId,
          action: 'move',
          newScheduled: movedFixture
            ? String(movedFixture.scheduled)
            : String(fixtureToMove.scheduled),
          pitch: destPitch,
        };
      } else {
        // CROSS PITCH: Remove from source, insert into dest, recalculate using durations
        const sourceFixtures = await select(
          `SELECT id, scheduled, durationPlanned FROM fixtures
           WHERE tournamentId = ? AND pitch = ?
           ORDER BY scheduled ASC, id ASC`,
          [tournamentId, sourcePitch]
        );

        const destFixtures = await select(
          `SELECT id, scheduled, durationPlanned FROM fixtures
           WHERE tournamentId = ? AND pitch = ?
           ORDER BY scheduled ASC, id ASC`,
          [tournamentId, destPitch]
        );

        // Save original start times
        const sourceStartTime =
          sourceFixtures.length > 0
            ? new Date(String(sourceFixtures[0].scheduled)).getTime()
            : new Date(String(fixtureToMove.scheduled)).getTime();
        const destStartTime =
          destFixtures.length > 0
            ? new Date(String(destFixtures[0].scheduled)).getTime()
            : new Date(String(fixtureToMove.scheduled)).getTime();

        // Remove from source
        const sourceIndex = sourceFixtures.findIndex(
          (f: any) => f.id === fixtureId
        );
        sourceFixtures.splice(sourceIndex, 1);

        // Insert into dest
        const targetIndex = destFixtures.findIndex(
          (f: any) => f.id === relativeFixtureId
        );
        const insertIndex =
          placement === 'after' ? targetIndex + 1 : targetIndex;
        destFixtures.splice(insertIndex, 0, fixtureToMove);

        // Recalculate: sequential from start time using actual durations
        const recalculate = (list: any[], startTime: number) => {
          let currentTime = startTime;
          for (const f of list) {
            f.newScheduled = new Date(currentTime)
              .toISOString()
              .slice(0, 19)
              .replace('T', ' ');
            const duration = Number(f.durationPlanned) || 20;
            currentTime += duration * 60000;
          }
        };

        recalculate(sourceFixtures, sourceStartTime);
        recalculate(destFixtures, destStartTime);

        // Update all in transaction
        await transaction(async (tx) => {
          await tx.update(
            `UPDATE fixtures SET pitch = ? WHERE id = ? AND tournamentId = ?`,
            [destPitch, fixtureId, tournamentId]
          );

          for (const f of sourceFixtures) {
            await tx.update(
              `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
              [f.newScheduled, f.id, tournamentId]
            );
          }

          for (const f of destFixtures) {
            await tx.update(
              `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
              [f.newScheduled, f.id, tournamentId]
            );
          }
        });

        const movedFixture = destFixtures.find((f: any) => f.id === fixtureId);
        return {
          fixtureId,
          action: 'move',
          newScheduled: movedFixture
            ? String(movedFixture.newScheduled)
            : String(fixtureToMove.scheduled),
          pitch: destPitch,
        };
      }
    },

    copyFixtures: async (
      sourceTournamentId: number,
      targetTournamentId: number
    ) => {
      const [sourceTournament] = await select(
        `SELECT \`Date\` FROM tournaments WHERE id = ?`,
        [sourceTournamentId]
      );
      if (!sourceTournament) {
        const error = new Error('Source tournament not found') as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'SOURCE_TOURNAMENT_NOT_FOUND';
        throw error;
      }

      const [targetTournament] = await select(
        `SELECT \`Date\` FROM tournaments WHERE id = ?`,
        [targetTournamentId]
      );
      if (!targetTournament) {
        const error = new Error('Target tournament not found') as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'TARGET_TOURNAMENT_NOT_FOUND';
        throw error;
      }

      const sourceDate = new Date(String(sourceTournament.Date));
      const targetDate = new Date(String(targetTournament.Date));
      const dayOffsetMs = targetDate.getTime() - sourceDate.getTime();

      const sourceFixtures = await select(
        `SELECT * FROM fixtures WHERE tournamentId = ? ORDER BY id`,
        [sourceTournamentId]
      );

      if (sourceFixtures.length === 0) {
        return { copied: 0, fixtures: [], cards: [] };
      }

      const sourceCards = await select(
        `SELECT * FROM cards WHERE tournamentId = ?`,
        [sourceTournamentId]
      );

      const idMapping = new Map<number, number>();
      for (const fixture of sourceFixtures) {
        const oldId = fixture.id as number;
        const suffix = oldId % 10_000;
        const newId = targetTournamentId * 10_000 + suffix;
        idMapping.set(oldId, newId);
      }

      const adjustDate = (value: any): string | null => {
        if (!value) return null;
        const d = new Date(String(value));
        d.setTime(d.getTime() + dayOffsetMs);
        return d.toISOString().slice(0, 19).replace('T', ' ');
      };

      const updatePlaceholders = (value: any): any => {
        if (!value || typeof value !== 'string') return value;
        return value.replace(
          /~match:(\d+)\/p:(\d+)/g,
          (_match: string, oldMatchId: string, position: string) => {
            const oldFixtureId = parseInt(oldMatchId, 10);
            const newFixtureId = idMapping.get(oldFixtureId);
            if (newFixtureId) {
              return `~match:${newFixtureId}/p:${position}`;
            }
            return _match;
          }
        );
      };

      await transaction(async (tx) => {
        await tx.delete(`DELETE FROM cards WHERE tournamentId = ?`, [
          targetTournamentId,
        ]);
        await tx.delete(`DELETE FROM fixtures WHERE tournamentId = ?`, [
          targetTournamentId,
        ]);

        for (const fixture of sourceFixtures) {
          const oldId = fixture.id as number;
          const newId = idMapping.get(oldId)!;

          await tx.insert(
            `INSERT INTO fixtures (
              id, tournamentId, category, groupNumber, stage, pitchPlanned, pitch,
              scheduledPlanned, scheduled, started, ended,
              team1Planned, team1Id, goals1, goals1Extra, goals1Penalties, points1, points1Extra,
              team2Planned, team2Id, goals2, goals2Extra, goals2Penalties, points2, points2Extra,
              umpireTeamPlanned, umpireTeamId, notes, outcome
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newId,
              targetTournamentId,
              fixture.category,
              fixture.groupNumber,
              fixture.stage,
              fixture.pitchPlanned,
              fixture.pitch,
              adjustDate(fixture.scheduledPlanned),
              adjustDate(fixture.scheduled),
              adjustDate(fixture.started),
              adjustDate(fixture.ended),
              updatePlaceholders(fixture.team1Planned),
              updatePlaceholders(fixture.team1Id),
              fixture.goals1,
              fixture.goals1Extra,
              fixture.goals1Penalties,
              fixture.points1,
              fixture.points1Extra,
              updatePlaceholders(fixture.team2Planned),
              updatePlaceholders(fixture.team2Id),
              fixture.goals2,
              fixture.goals2Extra,
              fixture.goals2Penalties,
              fixture.points2,
              fixture.points2Extra,
              updatePlaceholders(fixture.umpireTeamPlanned),
              updatePlaceholders(fixture.umpireTeamId),
              fixture.notes,
              fixture.outcome,
            ]
          );
        }

        for (const card of sourceCards) {
          const oldFixtureId = card.fixtureId as number;
          const newFixtureId = idMapping.get(oldFixtureId);
          if (!newFixtureId) continue;

          await tx.insert(
            `INSERT INTO cards (tournamentId, fixtureId, playerId, playerNumber, playerName, cardColor, team) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              targetTournamentId,
              newFixtureId,
              card.playerId,
              card.playerNumber,
              card.playerName,
              card.cardColor,
              card.team,
            ]
          );
        }
      });

      const copiedFixtures = await select(
        `SELECT * FROM fixtures WHERE tournamentId = ? ORDER BY id`,
        [targetTournamentId]
      );

      return {
        copied: copiedFixtures.length,
        fixtures: copiedFixtures,
        cards: await select(`SELECT * FROM cards WHERE tournamentId = ?`, [
          targetTournamentId,
        ]),
      };
    },
  };
}
