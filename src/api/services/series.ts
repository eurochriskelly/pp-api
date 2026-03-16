import dbHelper = require('../../lib/db-helper');

interface Series {
  id: number;
  name: string;
  description?: string | null;
  sport?: string | null;
  defaultSquadSize?: number;
  defaultPlayersPerTeam?: number;
  rulesetId?: number | null;
  status?: 'active' | 'inactive';
}

interface Championship {
  id: number;
  seriesId: number;
  name: string;
  year: number;
  status: string;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

function seriesService(db: DbConnection) {
  const { select, insert, update } = dbHelper(db as any);

  return {
    listSeries: async (status?: string): Promise<Series[]> => {
      let sql =
        'SELECT id, name, description, sport, defaultSquadSize, defaultPlayersPerTeam, rulesetId, status FROM series';
      const params: (string | number)[] = [];

      if (status && (status === 'active' || status === 'inactive')) {
        sql += ' WHERE status = ?';
        params.push(status);
      }

      sql += ' ORDER BY name';
      return (await select(sql, params)) as unknown as Series[];
    },

    getSeriesById: async (
      id: number
    ): Promise<(Series & { championshipIds: number[] }) | null> => {
      const rows = (await select(
        `SELECT id, name, description, sport, defaultSquadSize,
                defaultPlayersPerTeam, rulesetId, status
         FROM series
         WHERE id = ?`,
        [id]
      )) as unknown as Series[];

      if (!rows[0]) {
        return null;
      }

      const championshipRows = (await select(
        `SELECT id FROM championships WHERE seriesId = ? ORDER BY year DESC, name ASC`,
        [id]
      )) as unknown as Array<{ id: number }>;

      return {
        ...rows[0],
        championshipIds: championshipRows.map((row) => row.id),
      };
    },

    createSeries: async (data: Partial<Series>): Promise<Series> => {
      const id = await insert(
        `INSERT INTO series (
          name, description, sport, defaultSquadSize, defaultPlayersPerTeam, rulesetId, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.description || null,
          data.sport || null,
          data.defaultSquadSize || 15,
          data.defaultPlayersPerTeam || 15,
          data.rulesetId || null,
          data.status || 'active',
        ]
      );

      return {
        id,
        name: data.name as string,
        description: data.description || null,
        sport: data.sport || null,
        defaultSquadSize: data.defaultSquadSize || 15,
        defaultPlayersPerTeam: data.defaultPlayersPerTeam || 15,
        rulesetId: data.rulesetId || null,
        status: (data.status as 'active' | 'inactive') || 'active',
      };
    },

    updateSeries: async (id: number, data: Partial<Series>) => {
      const fields: string[] = [];
      const params: (string | number | null)[] = [];

      const allowedFields: Array<keyof Series> = [
        'name',
        'description',
        'sport',
        'defaultSquadSize',
        'defaultPlayersPerTeam',
        'rulesetId',
        'status',
      ];

      allowedFields.forEach((field) => {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(data[field] as string | number | null);
        }
      });

      if (fields.length === 0) {
        return { id, message: 'No changes provided' };
      }

      params.push(id);
      await update(
        `UPDATE series SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      return { id, ...data };
    },

    deleteSeries: async (id: number, hard: boolean = false) => {
      if (hard) {
        // Hard delete - cascade delete all related data
        const existing = await select(`SELECT id FROM series WHERE id = ?`, [
          id,
        ]);

        if (!existing || (existing as any[]).length === 0) {
          throw new Error('Series not found');
        }

        // Get all championship IDs for this series
        const championshipRows = (await select(
          `SELECT id FROM championships WHERE seriesId = ?`,
          [id]
        )) as Array<{ id: number }>;

        const championshipIds = championshipRows.map((r) => r.id);

        if (championshipIds.length > 0) {
          // Get all entrant IDs for these championships
          const entrantRows = (await select(
            `SELECT id FROM championship_entrants WHERE championshipId IN (${championshipIds.join(',')})`,
            []
          )) as Array<{ id: number }>;

          const entrantIds = entrantRows.map((r) => r.id);

          if (entrantIds.length > 0) {
            // Delete team_entrants (via entrantId)
            await update(
              `DELETE FROM team_entrants WHERE entrantId IN (${entrantIds.join(',')})`,
              []
            );

            // Delete amalgamation_clubs (via entrantId)
            await update(
              `DELETE FROM amalgamation_clubs WHERE entrantId IN (${entrantIds.join(',')})`,
              []
            );

            // Delete tournament_teams (via entrantId)
            await update(
              `DELETE FROM tournament_teams WHERE entrantId IN (${entrantIds.join(',')})`,
              []
            );
          }

          // Delete championships - championship_entrants will cascade
          await update(`DELETE FROM championships WHERE seriesId = ?`, [id]);
        }

        // Delete series
        await update(`DELETE FROM series WHERE id = ?`, [id]);

        return { id, message: 'Series hard deleted' };
      } else {
        // Soft delete - mark as inactive and archive championships
        const existing = await select(
          `SELECT id, status FROM series WHERE id = ?`,
          [id]
        );

        if (!existing || (existing as any[]).length === 0) {
          throw new Error('Series not found');
        }

        const seriesRow = (existing as any[])[0];
        if (seriesRow.status === 'inactive') {
          return { id, message: 'Series already inactive' };
        }

        await update(`UPDATE series SET status = 'inactive' WHERE id = ?`, [
          id,
        ]);

        await update(
          `UPDATE championships SET status = 'archived' WHERE seriesId = ? AND status != 'archived'`,
          [id]
        );

        return { id, message: 'Series deactivated' };
      }
    },

    listSeriesChampionships: async (
      seriesId: number
    ): Promise<Championship[]> => {
      return (await select(
        `SELECT id, seriesId, name, year, status
         FROM championships
         WHERE seriesId = ?
         ORDER BY year DESC, name ASC`,
        [seriesId]
      )) as unknown as Championship[];
    },
  };
}

export = seriesService;
