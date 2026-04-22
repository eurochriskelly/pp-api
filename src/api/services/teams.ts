import dbHelper from '../../lib/db-helper';
import { II } from '../../lib/logging';

type TeamPayload = {
  name?: string;
  tournamentTempUuid?: string;
  tournamentId?: number | null;
  competition?: string | null;
  contributingClubs?: any;
  colors?: any;
};

const parseJsonField = (value: any) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};

const normalizeTeam = (row: any) => ({
  id: row.id,
  name: row.name,
  tournamentTempUuid: row.tournamentTempUuid,
  tournamentId: row.tournamentId,
  competition: row.competition,
  contributingClubs: parseJsonField(row.contributingClubs),
  colors: parseJsonField(row.colors),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export default (db: any) => {
  const { select, insert, update, transaction } = dbHelper(db);

  const getTeamById = async (id: number) => {
    const rows = await select(
      `SELECT id, name, tournamentTempUuid, tournamentId, competition, contributingClubs, colors, created_at, updated_at
       FROM teams
       WHERE id = ?`,
      [id]
    );
    return rows[0] ? normalizeTeam(rows[0]) : null;
  };

  return {
    getTeams: async ({
      tournamentTempUuid,
      tournamentId,
      competition,
    }: {
      tournamentTempUuid?: string;
      tournamentId?: number;
      competition?: string;
    }) => {
      const conditions: string[] = [];
      const params: any[] = [];

      if (tournamentTempUuid) {
        conditions.push('tournamentTempUuid = ?');
        params.push(tournamentTempUuid);
      }
      if (typeof tournamentId === 'number') {
        conditions.push('tournamentId = ?');
        params.push(tournamentId);
      }
      if (competition) {
        conditions.push('competition = ?');
        params.push(competition);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await select(
        `SELECT id, name, tournamentTempUuid, tournamentId, competition, contributingClubs, colors, created_at, updated_at
         FROM teams
         ${whereClause}
         ORDER BY id DESC`,
        params
      );
      return rows.map(normalizeTeam);
    },

    getTeamById,

    createTeam: async (payload: TeamPayload) => {
      const id = await insert(
        `INSERT INTO teams (
          name,
          tournamentTempUuid,
          tournamentId,
          competition,
          contributingClubs,
          colors
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          payload.name,
          payload.tournamentTempUuid,
          payload.tournamentId || null,
          payload.competition || null,
          payload.contributingClubs
            ? JSON.stringify(payload.contributingClubs)
            : null,
          payload.colors ? JSON.stringify(payload.colors) : null,
        ]
      );

      return await getTeamById(id);
    },

    createBatch: async (tournamentTempUuid: string, teams: TeamPayload[]) => {
      II(
        `[TEAMS] Creating batch of ${teams.length} teams with temp UUID: ${tournamentTempUuid}`
      );
      const ids: number[] = [];

      await transaction(async (tx) => {
        for (const team of teams) {
          if (!team?.name) {
            throw new Error('Each team requires a name');
          }

          const createdId = await tx.insert(
            `INSERT INTO teams (
              name,
              tournamentTempUuid,
              tournamentId,
              competition,
              contributingClubs,
              colors
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              team.name,
              team.tournamentTempUuid || tournamentTempUuid,
              team.tournamentId || null,
              team.competition || null,
              team.contributingClubs
                ? JSON.stringify(team.contributingClubs)
                : null,
              team.colors ? JSON.stringify(team.colors) : null,
            ]
          );
          ids.push(createdId);
        }
      });

      II(`[TEAMS] ✓ Successfully created ${ids.length} teams`);

      const placeholders = ids.map(() => '?').join(',');
      const rows = await select(
        `SELECT id, name, tournamentTempUuid, tournamentId, competition, contributingClubs, colors, created_at, updated_at
         FROM teams
         WHERE id IN (${placeholders})
         ORDER BY id ASC`,
        ids
      );
      return rows.map(normalizeTeam);
    },

    assignTournament: async (
      tournamentTempUuid: string,
      tournamentId: number
    ) => {
      const affectedRows = await update(
        `UPDATE teams
         SET tournamentId = ?
         WHERE tournamentTempUuid = ?`,
        [tournamentId, tournamentTempUuid]
      );

      return {
        tournamentTempUuid,
        tournamentId,
        affectedRows,
      };
    },

    updateTeam: async (id: number, payload: TeamPayload) => {
      const fields: string[] = [];
      const params: any[] = [];

      if (payload.name !== undefined) {
        fields.push('name = ?');
        params.push(payload.name);
      }
      if (payload.tournamentTempUuid !== undefined) {
        fields.push('tournamentTempUuid = ?');
        params.push(payload.tournamentTempUuid);
      }
      if (payload.tournamentId !== undefined) {
        fields.push('tournamentId = ?');
        params.push(payload.tournamentId);
      }
      if (payload.competition !== undefined) {
        fields.push('competition = ?');
        params.push(payload.competition);
      }
      if (payload.contributingClubs !== undefined) {
        fields.push('contributingClubs = ?');
        params.push(
          payload.contributingClubs
            ? JSON.stringify(payload.contributingClubs)
            : null
        );
      }
      if (payload.colors !== undefined) {
        fields.push('colors = ?');
        params.push(payload.colors ? JSON.stringify(payload.colors) : null);
      }

      if (fields.length > 0) {
        params.push(id);
        await update(
          `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`,
          params
        );
      }

      return await getTeamById(id);
    },

    uploadLogo: async (id: number, logoBuffer: Buffer) => {
      const affectedRows = await update(
        `UPDATE teams SET logo = ? WHERE id = ?`,
        [logoBuffer, id]
      );
      return {
        id,
        affectedRows,
      };
    },

    getLogo: async (id: number) => {
      const rows = await select(`SELECT logo FROM teams WHERE id = ?`, [id]);
      return rows[0]?.logo || null;
    },
  };
};
