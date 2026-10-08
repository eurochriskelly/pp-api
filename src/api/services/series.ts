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
  regions?: SeriesRegion[];
}

interface SeriesRegion {
  region: string;
  subregion?: string | null;
}

interface EligibleClub {
  clubId: number;
  clubName: string;
  city: string | null;
  region: string;
  subregion: string | null;
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
  const { select, insert, update, transaction } = dbHelper(db as any);

  const listRegions = async (seriesId: number): Promise<SeriesRegion[]> =>
    (await select(
      `SELECT region, NULLIF(subregion, '') AS subregion
       FROM series_regions WHERE seriesId = ? ORDER BY region, subregion`,
      [seriesId]
    )) as unknown as SeriesRegion[];

  const replaceRegions = async (
    helper: ReturnType<typeof dbHelper>,
    seriesId: number,
    regions: SeriesRegion[]
  ) => {
    const unique = new Map<string, SeriesRegion>();
    regions.forEach(({ region, subregion }) => {
      const cleanRegion = String(region || '').trim();
      const cleanSubregion = String(subregion || '').trim();
      if (cleanRegion)
        unique.set(`${cleanRegion}:${cleanSubregion}`, {
          region: cleanRegion,
          subregion: cleanSubregion || null,
        });
    });
    await helper.delete('DELETE FROM series_regions WHERE seriesId = ?', [
      seriesId,
    ]);
    for (const assignment of unique.values()) {
      await helper.insert(
        'INSERT INTO series_regions (seriesId, region, subregion) VALUES (?, ?, ?)',
        [seriesId, assignment.region, assignment.subregion || '']
      );
    }
    return [...unique.values()];
  };

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
      const rows = (await select(sql, params)) as unknown as Series[];
      return Promise.all(
        rows.map(async (series) => ({
          ...series,
          regions: await listRegions(series.id),
        }))
      );
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
        regions: await listRegions(id),
        championshipIds: championshipRows.map((row) => row.id),
      };
    },

    createSeries: async (data: Partial<Series>): Promise<Series> => {
      const regions = Array.isArray(data.regions) ? data.regions : [];
      const id = await transaction(async (helper) => {
        const seriesId = await helper.insert(
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
        await replaceRegions(helper, seriesId, regions);
        return seriesId;
      });

      return {
        id,
        name: data.name as string,
        description: data.description || null,
        sport: data.sport || null,
        defaultSquadSize: data.defaultSquadSize || 15,
        defaultPlayersPerTeam: data.defaultPlayersPerTeam || 15,
        rulesetId: data.rulesetId || null,
        status: (data.status as 'active' | 'inactive') || 'active',
        regions,
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

      if (fields.length > 0) {
        params.push(id);
        await update(
          `UPDATE series SET ${fields.join(', ')} WHERE id = ?`,
          params
        );
      }
      const regions = Array.isArray(data.regions)
        ? await replaceRegions(dbHelper(db as any), id, data.regions)
        : await listRegions(id);
      if (fields.length === 0 && data.regions === undefined)
        return { id, message: 'No changes provided' };

      return { id, ...data, regions };
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

    listEligibleClubs: async (seriesId: number): Promise<EligibleClub[]> => {
      return (await select(
        `SELECT DISTINCT c.clubId, c.clubName, c.city, c.region,
                NULLIF(c.subregion, '') AS subregion
         FROM series_regions sr
         JOIN clubs c ON c.region = sr.region
          AND COALESCE(c.subregion, '') = sr.subregion
         JOIN gge_import_clubs g ON g.clubId = c.clubId
         WHERE sr.seriesId = ? AND c.status = 'active'
         ORDER BY c.clubName`,
        [seriesId]
      )) as unknown as EligibleClub[];
    },
  };
}

export = seriesService;
