import dbHelper from '../../lib/db-helper';
import { mysqlCurrentTime } from '../../lib/utils';
import calculatedFixturesService, {
  refreshCalculatedFixtures,
} from './fixtures/calculated-fixtures';
import enhanceFixtureFactory from './fixtures/enhance-fixture';
import TSVValidator from './fixtures/validate-tsv';
import { DD } from '../../lib/logging';

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
  plannedTime?: string;
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

export interface SlackInput {
  tournamentId: number;
  fixtureId: number;
  minutes: number;
}

export interface SlackResult {
  fixtureId: number;
  minutes: number;
  affectedCount: number;
  newScheduled?: string;
}

export default function fixturesService(db: any) {
  const {
    select,
    insert,
    update,
    transaction,
    delete: dbDelete,
  } = dbHelper(db);

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
         SET goals1 = NULL, points1 = NULL, goals2 = NULL, points2 = NULL,
             started = NULL, outcome = 'not played'
         WHERE id = ?`,
        [latest.id]
      );
      return latest;
    },

    startFixture: async (fixtureId: number) => {
      const timestamp = mysqlCurrentTime();
      await update(
        `UPDATE fixtures SET started = ?, outcome = 'in-progress' WHERE id = ?`,
        [timestamp, fixtureId]
      );
      return { started: timestamp };
    },

    endFixture: async (fixtureId: number, outcome?: 'played' | 'skipped') => {
      const timestamp = mysqlCurrentTime();
      const [source] = await select(
        'SELECT tournamentId, category FROM fixtures WHERE id = ?',
        [fixtureId]
      );
      if (!source) throw new Error('Fixture not found');
      await transaction(async (tx) => {
        await tx.select('SELECT id FROM tournaments WHERE id = ? FOR UPDATE', [
          source.tournamentId,
        ]);
        await tx.update(
          'UPDATE fixtures SET ended = ?, outcome = ? WHERE id = ?',
          [timestamp, outcome || 'played', fixtureId]
        );
        await refreshCalculatedFixtures(tx, Number(source.tournamentId), {
          category: String(source.category),
        });
      });
      return { ended: timestamp };
    },

    updateScore: async (
      tournamentId: number,
      fixtureId: number,
      team1: TeamScore,
      team2: TeamScore,
      outcome: string
    ) => {
      const resolvedOutcome = outcome || 'in-progress';
      return transaction(async (tx) => {
        const [tournament] = await tx.select(
          `SELECT id FROM tournaments WHERE id = ? FOR UPDATE`,
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

        await tx.update(
          `UPDATE fixtures
         SET goals1 = ?, points1 = ?, goals1Extra = ?, points1Extra = ?, goals1Penalties = ?,
             goals2 = ?, points2 = ?, goals2Extra = ?, points2Extra = ?, goals2Penalties = ?,
             outcome = ?
         WHERE id = ? AND tournamentId = ?`,
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
            resolvedOutcome,
            fixtureId,
            tournamentId,
          ]
        );

        const [fixture] = await tx.select(
          'SELECT category FROM fixtures WHERE id = ? AND tournamentId = ?',
          [fixtureId, tournamentId]
        );
        if (fixture) {
          await refreshCalculatedFixtures(tx, tournamentId, {
            category: String(fixture.category),
          });
        }
        return { updated: true };
      });
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
      plannedTime,
    }: RescheduleInput): Promise<RescheduleResult> => {
      // 1. Load fixture to move
      const [fixtureToMove] = await select(
        `SELECT id, scheduled, pitch, durationPlanned, started, ended FROM fixtures
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

      const sourcePitch: string = String(fixtureToMove.pitch);
      const isLocked = (fixture: any) =>
        Boolean(fixture.started || fixture.ended);

      if (isLocked(fixtureToMove)) {
        const error = new Error(
          'Played fixtures are fixed and cannot be rescheduled'
        ) as Error & { statusCode?: number; code?: string };
        error.statusCode = 409;
        error.code = 'FIXTURE_LOCKED';
        throw error;
      }

      // The reorder dialog sends its reviewed draft as exact fixture changes.
      // Persist it verbatim instead of running a second, potentially different
      // scheduling calculation after the operator has confirmed the preview.
      if (plannedTime) {
        const scheduled = new Date(String(fixtureToMove.scheduled));
        const [hours, minutes] = plannedTime.split(':').map(Number);
        if (!Number.isFinite(scheduled.getTime()) || hours > 23 || minutes > 59) {
          throw new Error('Invalid planned fixture time');
        }
        scheduled.setHours(hours, minutes, 0, 0);
        const pad = (value: number) => String(value).padStart(2, '0');
        const newScheduled = `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())} ${pad(scheduled.getHours())}:${pad(scheduled.getMinutes())}:${pad(scheduled.getSeconds())}`;
        const destPitch = targetPitch || sourcePitch;
        await update(
          `UPDATE fixtures SET pitch = ?, scheduled = ? WHERE id = ? AND tournamentId = ?`,
          [destPitch, newScheduled, fixtureId, tournamentId]
        );
        return { fixtureId, action: 'move', newScheduled, pitch: destPitch };
      }

      // 2. Load target fixture
      const [targetFixture] = await select(
        `SELECT id, scheduled, pitch, durationPlanned, started, ended FROM fixtures
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

      const destPitch: string = targetPitch || String(targetFixture.pitch);

      if (isLocked(targetFixture)) {
        const error = new Error(
          'Played fixtures are fixed and cannot be rescheduled'
        ) as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 409;
        error.code = 'FIXTURE_LOCKED';
        throw error;
      }

      if (sourcePitch === destPitch) {
        // SAME PITCH: Rotate time slots
        const fixtures = await select(
          `SELECT id, scheduled, durationPlanned, started, ended FROM fixtures
           WHERE tournamentId = ? AND pitch = ?
           ORDER BY scheduled ASC, id ASC`,
          [tournamentId, sourcePitch]
        );

        // Save original time slots
        const timeSlots = fixtures
          .filter((f: any) => !isLocked(f))
          .map((f: any) => f.scheduled);

        // Find and remove moved fixture
        const movedIndex = fixtures.findIndex((f: any) => f.id === fixtureId);
        fixtures.splice(movedIndex, 1);

        // Find target position
        const targetIndex = fixtures.findIndex(
          (f: any) => f.id === relativeFixtureId
        );
        if (
          fixtures
            .slice(
              Math.min(movedIndex, targetIndex),
              Math.max(movedIndex, targetIndex) + 1
            )
            .some((fixture: any) => isLocked(fixture))
        ) {
          const error = new Error(
            'Played fixtures are fixed and cannot be crossed'
          ) as Error & { statusCode?: number; code?: string };
          error.statusCode = 409;
          error.code = 'FIXTURE_LOCKED';
          throw error;
        }
        const insertIndex =
          placement === 'after' ? targetIndex + 1 : targetIndex;

        // Insert moved fixture at new position
        fixtures.splice(insertIndex, 0, fixtureToMove);

        let movableIndex = 0;
        fixtures.forEach((fixture: any) => {
          if (!isLocked(fixture))
            fixture.newScheduled = timeSlots[movableIndex++];
        });

        // Assign saved time slots to fixtures by position
        await transaction(async (tx) => {
          for (let i = 0; i < fixtures.length; i++) {
            await tx.update(
              `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
              [fixtures[i].newScheduled, fixtures[i].id, tournamentId]
            );
          }
        });

        const movedFixture = fixtures.find((f: any) => f.id === fixtureId);
        return {
          fixtureId,
          action: 'move',
          newScheduled: movedFixture
            ? String(movedFixture.newScheduled || movedFixture.scheduled)
            : String(fixtureToMove.scheduled),
          pitch: destPitch,
        };
      } else {
        // CROSS PITCH: preserve the published timing. Moving one fixture must
        // never rebuild either pitch into minimum-duration slots; that destroys
        // intentional gaps in the schedule. The source simply gains an opening.
        // On the destination, only a real overlap pushes later fixtures forward.
        const destFixtures = await select(
          `SELECT id, scheduled, durationPlanned, started, ended FROM fixtures
           WHERE tournamentId = ? AND pitch = ?
           ORDER BY scheduled ASC, id ASC`,
          [tournamentId, destPitch]
        );

        const formatDateTime = (time: number) => {
          const date = new Date(time);
          const pad = (value: number) => String(value).padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        };

        const destinationSchedule = [...destFixtures, fixtureToMove].sort(
          (a: any, b: any) => {
            const timeDifference =
              new Date(String(a.scheduled)).getTime() -
              new Date(String(b.scheduled)).getTime();
            if (timeDifference !== 0) return timeDifference;
            if (a.id === fixtureId) return placement === 'before' && b.id === relativeFixtureId ? -1 : 1;
            if (b.id === fixtureId) return placement === 'before' && a.id === relativeFixtureId ? 1 : -1;
            return a.id - b.id;
          }
        );

        let occupiedUntil: number | null = null;
        for (const fixture of destinationSchedule) {
          const originalTime = new Date(String(fixture.scheduled)).getTime();
          const scheduledTime = occupiedUntil === null
            ? originalTime
            : Math.max(originalTime, occupiedUntil);

          if (isLocked(fixture) && scheduledTime !== originalTime) {
            const error = new Error(
              'Played fixtures are fixed and cannot be moved to make room'
            ) as Error & { statusCode?: number; code?: string };
            error.statusCode = 409;
            error.code = 'FIXTURE_LOCKED';
            throw error;
          }

          fixture.newScheduled = scheduledTime === originalTime
            ? fixture.scheduled
            : formatDateTime(scheduledTime);
          occupiedUntil = scheduledTime +
            (Number(fixture.durationPlanned) || 20) * 60000;
        }

        // Update all in transaction
        await transaction(async (tx) => {
          await tx.update(
            `UPDATE fixtures SET pitch = ? WHERE id = ? AND tournamentId = ?`,
            [destPitch, fixtureId, tournamentId]
          );

          for (const f of destinationSchedule) {
            await tx.update(
              `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
              [f.newScheduled, f.id, tournamentId]
            );
          }
        });

        const movedFixture = destinationSchedule.find((f: any) => f.id === fixtureId);
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

    slack: async ({
      tournamentId,
      fixtureId,
      minutes,
    }: SlackInput): Promise<SlackResult> => {
      // 1. Load fixture
      const [fixture] = await select(
        `SELECT id, scheduled, pitch FROM fixtures
         WHERE id = ? AND tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      if (!fixture) {
        const error = new Error(`Fixture ${fixtureId} not found`) as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'FIXTURE_NOT_FOUND';
        throw error;
      }

      const pitch = String(fixture.pitch);

      // 2. Load all fixtures on the same pitch ordered by scheduled time
      const fixtures = await select(
        `SELECT id, scheduled FROM fixtures
         WHERE tournamentId = ? AND pitch = ?
         ORDER BY scheduled ASC, id ASC`,
        [tournamentId, pitch]
      );

      // 3. Find the index of the selected fixture
      const slackIndex = fixtures.findIndex((f: any) => f.id === fixtureId);
      if (slackIndex === -1) {
        const error = new Error(
          `Fixture ${fixtureId} not found on pitch ${pitch}`
        ) as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'FIXTURE_NOT_ON_PITCH';
        throw error;
      }

      // 4. Apply slack to selected fixture and all subsequent fixtures
      const addMinutes = (value: string, mins: number) => {
        const date = new Date(String(value));
        date.setMinutes(date.getMinutes() + mins);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      };

      const affectedFixtures = fixtures.slice(slackIndex);
      for (const f of affectedFixtures) {
        f.newScheduled = addMinutes(String(f.scheduled), minutes);
      }

      // 5. Update in transaction
      await transaction(async (tx) => {
        for (const f of affectedFixtures) {
          await tx.update(
            `UPDATE fixtures SET scheduled = ? WHERE id = ? AND tournamentId = ?`,
            [f.newScheduled, f.id, tournamentId]
          );
        }
      });

      return {
        fixtureId,
        minutes,
        affectedCount: affectedFixtures.length,
        newScheduled: String(affectedFixtures[0].newScheduled),
      };
    },

    updateTemplateSetup: async (
      tournamentId: number,
      setup: {
        scheduleDate?: string;
        scheduleTime?: string;
        competitionRenames?: Array<{ from: string; to: string }>;
        teamRenames?: Array<{
          competition: string;
          groupNumber?: number | null;
          from: string;
          to: string;
        }>;
        groupRenames?: Array<{ competition: string; from: number; to: number }>;
      }
    ) => {
      const competitionRenames = (setup.competitionRenames || []).filter(
        (rename) => rename.from.trim() && rename.to.trim()
      );
      const teamRenames = (setup.teamRenames || []).filter(
        (rename) =>
          rename.competition.trim() && rename.from.trim() && rename.to.trim()
      );
      const groupRenames = (setup.groupRenames || []).filter(
        (rename) =>
          rename.competition.trim() &&
          Number.isInteger(rename.from) &&
          Number.isInteger(rename.to) &&
          rename.to > 0
      );
      if (
        !setup.scheduleDate &&
        !setup.scheduleTime &&
        !competitionRenames.length &&
        !teamRenames.length &&
        !groupRenames.length
      ) {
        return { updatedFixtures: 0, scheduleDate: null, scheduleTime: null };
      }
      const fixtures = (await select(
        `SELECT * FROM fixtures WHERE tournamentId = ? ORDER BY id`,
        [tournamentId]
      )) as any[];
      if (!fixtures.length) return { updatedFixtures: 0 };

      let scheduleOffsetMs: number | null = null;
      if (setup.scheduleDate || setup.scheduleTime) {
        if (
          !setup.scheduleDate ||
          !setup.scheduleTime ||
          !/^\d{4}-\d{2}-\d{2}$/.test(setup.scheduleDate) ||
          !/^\d{2}:\d{2}$/.test(setup.scheduleTime)
        ) {
          throw new Error(
            'A valid schedule date and time are required together'
          );
        }
        const sourceTimes = fixtures
          .flatMap((fixture) => [fixture.scheduledPlanned, fixture.scheduled])
          .map((value) => (value ? new Date(String(value)).getTime() : NaN))
          .filter((value) => Number.isFinite(value));
        if (!sourceTimes.length) {
          throw new Error(
            'The copied fixtures do not contain a valid schedule to shift'
          );
        }
        const sourceAnchor = Math.min(...sourceTimes);
        const targetAnchor = new Date(
          `${setup.scheduleDate}T${setup.scheduleTime}:00`
        ).getTime();
        if (!Number.isFinite(targetAnchor))
          throw new Error('Invalid schedule date or time');
        scheduleOffsetMs = targetAnchor - sourceAnchor;
      }

      const formatDateTime = (value: any): string | null => {
        if (!value || scheduleOffsetMs === null) return value || null;
        const date = new Date(String(value));
        if (!Number.isFinite(date.getTime())) return null;
        date.setTime(date.getTime() + scheduleOffsetMs);
        const pad = (number: number) => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      };
      const renamedCompetition = new Map(
        competitionRenames.map((rename) => [
          rename.from.trim(),
          rename.to.trim(),
        ])
      );
      const renamedGroup = new Map(
        groupRenames.map((rename) => [
          `${rename.competition.trim()}\u0000${rename.from}`,
          rename.to,
        ])
      );
      const renameTeam = (value: any, category: string, groupNumber: any) => {
        if (typeof value !== 'string') return value;
        const rename = teamRenames.find(
          (candidate) =>
            (candidate.competition === category ||
              candidate.competition === renamedCompetition.get(category)) &&
            (candidate.groupNumber == null ||
              Number(candidate.groupNumber) === Number(groupNumber)) &&
            candidate.from === value
        );
        return rename ? rename.to.trim() : value;
      };
      const renamedTeamNames = new Map<string, string>();
      for (const rename of teamRenames) {
        const key = `${rename.competition.toLocaleLowerCase()}\u0000${rename.to.trim().toLocaleLowerCase()}`;
        if (renamedTeamNames.has(key)) {
          const error = new Error(
            `Team names must be unique within ${rename.competition}`
          ) as Error & { statusCode?: number; code?: string };
          error.statusCode = 400;
          error.code = 'DUPLICATE_TEAM_NAME';
          throw error;
        }
        renamedTeamNames.set(key, rename.to.trim());
      }
      const finalTeamNames = new Map<string, Map<string, Set<string>>>();
      for (const fixture of fixtures) {
        const category = String(fixture.category || '');
        const competition = renamedCompetition.get(category) || category;
        const names = [
          fixture.team1Planned,
          fixture.team2Planned,
          fixture.umpireTeamPlanned,
        ];
        for (const original of names) {
          if (typeof original !== 'string' || original.startsWith('~'))
            continue;
          const finalName = String(
            renameTeam(original, category, fixture.groupNumber) || ''
          ).trim();
          if (
            !finalName ||
            (/^TEAM_[A-Z]+$/.test(finalName) && finalName === original)
          )
            continue;
          const competitionNames =
            finalTeamNames.get(competition) || new Map<string, Set<string>>();
          const identities =
            competitionNames.get(finalName.toLocaleLowerCase()) ||
            new Set<string>();
          identities.add(
            `${category}\u0000${fixture.groupNumber ?? 'all'}\u0000${original}`
          );
          competitionNames.set(finalName.toLocaleLowerCase(), identities);
          finalTeamNames.set(competition, competitionNames);
        }
      }
      for (const [competition, names] of finalTeamNames) {
        for (const identities of names.values()) {
          if (identities.size > 1) {
            const error = new Error(
              `Team names must be unique within ${competition}`
            ) as Error & { statusCode?: number; code?: string };
            error.statusCode = 400;
            error.code = 'DUPLICATE_TEAM_NAME';
            throw error;
          }
        }
      }

      await transaction(async (tx) => {
        if (setup.scheduleDate) {
          await tx.update(`UPDATE tournaments SET \`Date\` = ? WHERE id = ?`, [
            setup.scheduleDate,
            tournamentId,
          ]);
        }
        for (const fixture of fixtures) {
          const category = String(fixture.category || '');
          const updatedCategory = renamedCompetition.get(category) || category;
          const updatedGroupNumber =
            fixture.groupNumber == null
              ? fixture.groupNumber
              : (renamedGroup.get(`${category}\u0000${fixture.groupNumber}`) ??
                fixture.groupNumber);
          await tx.update(
            `UPDATE fixtures SET category = ?, groupNumber = ?, scheduledPlanned = ?, scheduled = ?,
              team1Planned = ?, team1Id = ?, team2Planned = ?, team2Id = ?,
              umpireTeamPlanned = ?, umpireTeamId = ?
             WHERE id = ? AND tournamentId = ?`,
            [
              updatedCategory,
              updatedGroupNumber,
              formatDateTime(fixture.scheduledPlanned),
              formatDateTime(fixture.scheduled),
              renameTeam(fixture.team1Planned, category, fixture.groupNumber),
              renameTeam(fixture.team1Id, category, fixture.groupNumber),
              renameTeam(fixture.team2Planned, category, fixture.groupNumber),
              renameTeam(fixture.team2Id, category, fixture.groupNumber),
              renameTeam(
                fixture.umpireTeamPlanned,
                category,
                fixture.groupNumber
              ),
              renameTeam(fixture.umpireTeamId, category, fixture.groupNumber),
              fixture.id,
              tournamentId,
            ]
          );
        }
      });

      return {
        updatedFixtures: fixtures.length,
        scheduleDate: setup.scheduleDate || null,
        scheduleTime: setup.scheduleTime || null,
      };
    },

    updateFixtureDetails: async (
      tournamentId: number,
      fixtureId: number,
      details: {
        field:
          | 'category'
          | 'team1'
          | 'team2'
          | 'umpireTeam'
          | 'pitch'
          | 'scheduledTime';
        value: string;
      }
    ) => {
      const [fixture] = await select(
        `SELECT * FROM fixtures WHERE id = ? AND tournamentId = ?`,
        [fixtureId, tournamentId]
      );
      if (!fixture) {
        const error = new Error('Fixture not found') as Error & {
          statusCode?: number;
          code?: string;
        };
        error.statusCode = 404;
        error.code = 'FIXTURE_NOT_FOUND';
        throw error;
      }
      if (
        fixture.started ||
        String(fixture.outcome || '').toLowerCase() === 'played'
      ) {
        const error = new Error(
          'Played fixtures cannot be changed'
        ) as Error & { statusCode?: number; code?: string };
        error.statusCode = 409;
        error.code = 'PLAYED_FIXTURE_READ_ONLY';
        throw error;
      }
      const value = details.value.trim();
      if (details.field === 'scheduledTime') {
        const oldTime = new Date(
          String(fixture.scheduled || fixture.scheduledTime)
        ).getTime();
        const newTime = new Date(value).getTime();
        if (!Number.isFinite(oldTime) || !Number.isFinite(newTime))
          throw new Error('Invalid fixture time');
        const delta = newTime - oldTime;
        const allFixtures = await select(
          `SELECT id, scheduled, scheduledPlanned FROM fixtures WHERE tournamentId = ?`,
          [tournamentId]
        );
        const shift = (raw: any) => {
          if (!raw) return raw;
          const date = new Date(String(raw));
          if (!Number.isFinite(date.getTime())) return raw;
          date.setTime(date.getTime() + delta);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        };
        await transaction(async (tx) => {
          for (const candidate of allFixtures) {
            if (
              new Date(
                String(candidate.scheduled || candidate.scheduledPlanned)
              ).getTime() < oldTime
            )
              continue;
            await tx.update(
              `UPDATE fixtures SET scheduled = ?, scheduledPlanned = ? WHERE id = ? AND tournamentId = ?`,
              [
                shift(candidate.scheduled),
                shift(candidate.scheduledPlanned),
                candidate.id,
                tournamentId,
              ]
            );
          }
        });
        return {
          updatedFixtures: allFixtures.filter(
            (candidate: any) =>
              new Date(
                String(candidate.scheduled || candidate.scheduledPlanned)
              ).getTime() >= oldTime
          ).length,
          timeShiftMinutes: Math.round(delta / 60000),
        };
      }

      const category = String(fixture.category || '');
      if (details.field === 'category') {
        await transaction(async (tx) => {
          await tx.update(
            `UPDATE fixtures SET category = ? WHERE tournamentId = ? AND category = ?`,
            [value, tournamentId, category]
          );
        });
        return {
          updatedFixtures:
            (
              await select(
                `SELECT COUNT(*) AS count FROM fixtures WHERE tournamentId = ? AND category = ?`,
                [tournamentId, value]
              )
            )[0]?.count || 0,
        };
      }
      if (details.field === 'pitch') {
        const oldPitch = String(fixture.pitch || '');
        await transaction(async (tx) => {
          await tx.update(
            `UPDATE fixtures SET pitch = ?, pitchPlanned = ? WHERE tournamentId = ? AND pitch = ?`,
            [value, value, tournamentId, oldPitch]
          );
        });
        return {
          updatedFixtures:
            (
              await select(
                `SELECT COUNT(*) AS count FROM fixtures WHERE tournamentId = ? AND pitch = ?`,
                [tournamentId, value]
              )
            )[0]?.count || 0,
        };
      }

      const fieldMap = {
        team1: ['team1Id', 'team1Planned'],
        team2: ['team2Id', 'team2Planned'],
        umpireTeam: ['umpireTeamId', 'umpireTeamPlanned'],
      } as const;
      const [idField, plannedField] =
        fieldMap[details.field as 'team1' | 'team2' | 'umpireTeam'];
      const oldValue = String(fixture[idField] || fixture[plannedField] || '');
      if (!oldValue || oldValue.startsWith('~'))
        throw new Error(
          'Placeholder participants must be edited from their planned source'
        );
      await transaction(async (tx) => {
        await tx.update(
          `UPDATE fixtures SET team1Id = CASE WHEN team1Id = ? THEN ? ELSE team1Id END, team2Id = CASE WHEN team2Id = ? THEN ? ELSE team2Id END, umpireTeamId = CASE WHEN umpireTeamId = ? THEN ? ELSE umpireTeamId END, team1Planned = CASE WHEN team1Planned = ? THEN ? ELSE team1Planned END, team2Planned = CASE WHEN team2Planned = ? THEN ? ELSE team2Planned END, umpireTeamPlanned = CASE WHEN umpireTeamPlanned = ? THEN ? ELSE umpireTeamPlanned END WHERE tournamentId = ? AND category = ?`,
          [
            oldValue,
            value,
            oldValue,
            value,
            oldValue,
            value,
            oldValue,
            value,
            oldValue,
            value,
            oldValue,
            value,
            tournamentId,
            category,
          ]
        );
      });
      return {
        updatedFixtures:
          (
            await select(
              `SELECT COUNT(*) AS count FROM fixtures WHERE tournamentId = ? AND category = ? AND (team1Id = ? OR team2Id = ? OR umpireTeamId = ?)`,
              [tournamentId, category, value, value, value]
            )
          )[0]?.count || 0,
      };
    },

    copyFixtures: async (
      sourceTournamentId: number,
      targetTournamentId: number,
      options: { templateTeams?: boolean; timeOffsetMinutes?: number } = {}
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

      const sourceFixtures = await select(
        `SELECT * FROM fixtures WHERE tournamentId = ? ORDER BY id`,
        [sourceTournamentId]
      );

      if (sourceFixtures.length === 0) {
        return { copied: 0, fixtures: [], cards: [] };
      }

      const sourceDate = new Date(String(sourceTournament.Date));
      const targetDate = new Date(String(targetTournament.Date));
      const sourceScheduleTimes = sourceFixtures
        .flatMap((fixture: any) => [
          fixture.scheduledPlanned,
          fixture.scheduled,
        ])
        .map((value: any) => (value ? new Date(String(value)).getTime() : NaN))
        .filter((value: number) => Number.isFinite(value));
      const sourceAnchor = sourceScheduleTimes.length
        ? Math.min(...sourceScheduleTimes)
        : sourceDate.getTime();
      const sourceAnchorDate = new Date(sourceAnchor);
      const targetAnchor = new Date(targetDate);
      targetAnchor.setHours(
        sourceAnchorDate.getHours(),
        sourceAnchorDate.getMinutes(),
        sourceAnchorDate.getSeconds(),
        0
      );
      const scheduleOffsetMs = targetAnchor.getTime() - sourceAnchor;
      const timeOffsetMs = (options.timeOffsetMinutes || 0) * 60_000;

      const sourceCards = await select(
        `SELECT * FROM cards WHERE tournamentId = ?`,
        [sourceTournamentId]
      );
      const sourcePitches = options.templateTeams
        ? await select(
            `SELECT pitch, location, type FROM pitches WHERE tournamentId = ? ORDER BY pitch`,
            [sourceTournamentId]
          )
        : [];

      const categoryMapping = new Map<string, string>();
      const pitchMapping = new Map<string, string>();
      if (options.templateTeams) {
        const templateName = (prefix: string, index: number) =>
          `${prefix}_${index + 1}`;
        sourceFixtures.forEach((fixture: any) => {
          const category = String(fixture.category || '');
          if (category && !categoryMapping.has(category)) {
            categoryMapping.set(
              category,
              templateName('COMP', categoryMapping.size)
            );
          }
          const pitch = String(fixture.pitch || fixture.pitchPlanned || '');
          if (pitch && !pitchMapping.has(pitch)) {
            pitchMapping.set(pitch, templateName('PITCH', pitchMapping.size));
          }
        });
        sourcePitches.forEach((pitch: any) => {
          const name = String(pitch.pitch || '');
          if (name && !pitchMapping.has(name)) {
            pitchMapping.set(name, templateName('PITCH', pitchMapping.size));
          }
        });
      }

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
        d.setTime(d.getTime() + scheduleOffsetMs + timeOffsetMs);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

      const teamMapping = new Map<string, string>();
      const globalTeamMapping = new Map<string, string>();
      const teamKey = (
        category: unknown,
        groupNumber: unknown,
        team: unknown
      ) =>
        `${String(category)}\u0000${String(groupNumber ?? 'all')}\u0000${String(team)}`;
      const globalTeamKey = (category: unknown, team: unknown) =>
        `${String(category)}\u0000${String(team)}`;
      const templateTeamName = (index: number) => {
        let value = index;
        let result = '';
        do {
          result = String.fromCharCode(65 + (value % 26)) + result;
          value = Math.floor(value / 26) - 1;
        } while (value >= 0);
        return `TEAM_${result}`;
      };

      if (options.templateTeams) {
        const nextIndexByCategory = new Map<string, number>();
        sourceFixtures.forEach((fixture) => {
          ['team1Id', 'team2Id'].forEach((field) => {
            const team = fixture[field];
            if (typeof team !== 'string' || !team || team.startsWith('~'))
              return;
            const key = teamKey(fixture.category, fixture.groupNumber, team);
            if (teamMapping.has(key)) return;
            const category = String(fixture.category);
            const nextIndex = nextIndexByCategory.get(category) || 0;
            teamMapping.set(key, templateTeamName(nextIndex));
            globalTeamMapping.set(
              globalTeamKey(fixture.category, team),
              teamMapping.get(key)!
            );
            nextIndexByCategory.set(category, nextIndex + 1);
          });
        });
      }

      const copyTeamValue = (
        value: any,
        category: unknown,
        groupNumber: unknown,
        isUmpire = false
      ) => {
        const placeholderAdjusted = updatePlaceholders(value);
        if (!options.templateTeams || typeof placeholderAdjusted !== 'string') {
          return placeholderAdjusted;
        }
        return (
          (isUmpire
            ? globalTeamMapping.get(
                globalTeamKey(category, placeholderAdjusted)
              )
            : teamMapping.get(
                teamKey(category, groupNumber, placeholderAdjusted)
              )) || placeholderAdjusted
        );
      };

      await transaction(async (tx) => {
        await tx.delete(`DELETE FROM cards WHERE tournamentId = ?`, [
          targetTournamentId,
        ]);
        await tx.delete(`DELETE FROM fixtures WHERE tournamentId = ?`, [
          targetTournamentId,
        ]);

        if (options.templateTeams) {
          await tx.delete(`DELETE FROM pitches WHERE tournamentId = ?`, [
            targetTournamentId,
          ]);
          for (const pitch of sourcePitches) {
            await tx.insert(
              `INSERT INTO pitches (pitch, location, type, tournamentId) VALUES (?, ?, ?, ?)`,
              [
                pitchMapping.get(String(pitch.pitch)) || pitch.pitch,
                pitch.location,
                pitch.type,
                targetTournamentId,
              ]
            );
          }
        }

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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newId,
              targetTournamentId,
              options.templateTeams
                ? categoryMapping.get(String(fixture.category)) ||
                  fixture.category
                : fixture.category,
              fixture.groupNumber,
              fixture.stage,
              options.templateTeams
                ? pitchMapping.get(
                    String(fixture.pitchPlanned || fixture.pitch)
                  ) || fixture.pitchPlanned
                : fixture.pitchPlanned,
              options.templateTeams
                ? pitchMapping.get(String(fixture.pitch)) || fixture.pitch
                : fixture.pitch,
              adjustDate(fixture.scheduledPlanned),
              adjustDate(fixture.scheduled),
              options.templateTeams ? null : adjustDate(fixture.started),
              options.templateTeams ? null : adjustDate(fixture.ended),
              copyTeamValue(
                fixture.team1Planned,
                fixture.category,
                fixture.groupNumber
              ),
              options.templateTeams
                ? copyTeamValue(
                    fixture.team1Planned,
                    fixture.category,
                    fixture.groupNumber
                  )
                : copyTeamValue(
                    fixture.team1Id,
                    fixture.category,
                    fixture.groupNumber
                  ),
              options.templateTeams ? null : fixture.goals1,
              options.templateTeams ? null : fixture.goals1Extra,
              options.templateTeams ? null : fixture.goals1Penalties,
              options.templateTeams ? null : fixture.points1,
              options.templateTeams ? null : fixture.points1Extra,
              copyTeamValue(
                fixture.team2Planned,
                fixture.category,
                fixture.groupNumber
              ),
              options.templateTeams
                ? copyTeamValue(
                    fixture.team2Planned,
                    fixture.category,
                    fixture.groupNumber
                  )
                : copyTeamValue(
                    fixture.team2Id,
                    fixture.category,
                    fixture.groupNumber
                  ),
              options.templateTeams ? null : fixture.goals2,
              options.templateTeams ? null : fixture.goals2Extra,
              options.templateTeams ? null : fixture.goals2Penalties,
              options.templateTeams ? null : fixture.points2,
              options.templateTeams ? null : fixture.points2Extra,
              copyTeamValue(
                fixture.umpireTeamPlanned,
                fixture.category,
                fixture.groupNumber,
                true
              ),
              options.templateTeams
                ? copyTeamValue(
                    fixture.umpireTeamPlanned,
                    fixture.category,
                    fixture.groupNumber,
                    true
                  )
                : copyTeamValue(
                    fixture.umpireTeamId,
                    fixture.category,
                    fixture.groupNumber,
                    true
                  ),
              fixture.notes,
              options.templateTeams ? 'not played' : fixture.outcome,
            ]
          );
        }

        for (const card of options.templateTeams ? [] : sourceCards) {
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

    updateCalculatedFixtures: async (
      tournamentId: number,
      fixtureId?: number
    ) => {
      let category: string | undefined;
      if (fixtureId) {
        const [fixture] = await select(
          'SELECT category FROM fixtures WHERE id = ? AND tournamentId = ?',
          [fixtureId, tournamentId]
        );
        if (!fixture) throw new Error('Fixture not found');
        category = String(fixture.category);
      }
      return calculatedFixturesService(db).refresh(tournamentId, {
        category,
        approveGroups: true,
      });
    },
  };
}
