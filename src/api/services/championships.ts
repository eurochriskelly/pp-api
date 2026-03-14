import dbHelper = require('../../lib/db-helper');

type ChampionshipStatus =
  | 'draft'
  | 'open'
  | 'in-progress'
  | 'completed'
  | 'archived';

type EntrantType = 'club' | 'amalgamation';

interface Championship {
  id: number;
  seriesId: number;
  name: string;
  year: number;
  numRounds: number;
  squadSize?: number | null;
  playersPerTeam?: number | null;
  status: ChampionshipStatus;
}

interface ChampionshipEntrant {
  id: number;
  championshipId: number;
  entrantType: EntrantType;
  clubId?: number | null;
  displayName: string;
  status: 'registered' | 'withdrawn' | 'active';
}

interface RoundSummary {
  roundNumber: number;
  tournamentCount: number;
  tournaments: Array<{
    id: number;
    title: string;
    date: string | null;
    status: string | null;
  }>;
}

interface StandingsRow {
  entrantId: number;
  displayName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

function championshipsService(db: DbConnection) {
  const { select, insert, update } = dbHelper(db as any);

  return {
    listChampionships: async ({
      seriesId,
      year,
      status,
    }: {
      seriesId?: unknown;
      year?: unknown;
      status?: unknown;
    }): Promise<Championship[]> => {
      const clauses: string[] = [];
      const params: Array<string | number> = [];

      if (seriesId !== undefined) {
        clauses.push('c.seriesId = ?');
        params.push(parseInt(seriesId as string, 10));
      }
      if (year !== undefined) {
        clauses.push('c.year = ?');
        params.push(parseInt(year as string, 10));
      }
      if (
        status !== undefined &&
        ['draft', 'open', 'in-progress', 'completed', 'archived'].includes(
          status as string
        )
      ) {
        clauses.push('c.status = ?');
        params.push(status as string);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      return (await select(
        `SELECT c.id, c.seriesId, c.name, c.year, c.numRounds, c.squadSize,
                c.playersPerTeam, c.status
         FROM championships c
         ${where}
         ORDER BY c.year DESC, c.name ASC`,
        params
      )) as unknown as Championship[];
    },

    getChampionshipById: async (id: number): Promise<Championship | null> => {
      const rows = (await select(
        `SELECT id, seriesId, name, year, numRounds, squadSize,
                playersPerTeam, status
         FROM championships
         WHERE id = ?`,
        [id]
      )) as unknown as Championship[];
      return rows[0] || null;
    },

    createChampionship: async (data: Partial<Championship>) => {
      const id = await insert(
        `INSERT INTO championships (
          seriesId, name, year, numRounds, squadSize, playersPerTeam, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.seriesId,
          data.name,
          data.year,
          data.numRounds || 4,
          data.squadSize || null,
          data.playersPerTeam || null,
          data.status || 'draft',
        ]
      );

      return {
        id,
        seriesId: data.seriesId,
        name: data.name,
        year: data.year,
        numRounds: data.numRounds || 4,
        squadSize: data.squadSize || null,
        playersPerTeam: data.playersPerTeam || null,
        status: data.status || 'draft',
      };
    },

    updateChampionship: async (id: number, data: Partial<Championship>) => {
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      const allowedFields: Array<keyof Championship> = [
        'seriesId',
        'name',
        'year',
        'numRounds',
        'squadSize',
        'playersPerTeam',
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
        `UPDATE championships SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      return { id, ...data };
    },

    deleteChampionship: async (id: number) => {
      await update(`UPDATE championships SET status = 'archived' WHERE id = ?`, [
        id,
      ]);
      return { id, message: 'Championship archived' };
    },

    listEntrants: async (championshipId: number): Promise<ChampionshipEntrant[]> => {
      return (await select(
        `SELECT id, championshipId, entrantType, clubId, displayName, status
         FROM championship_entrants
         WHERE championshipId = ?
         ORDER BY displayName ASC`,
        [championshipId]
      )) as unknown as ChampionshipEntrant[];
    },

    createEntrant: async (
      championshipId: number,
      data: Partial<ChampionshipEntrant>
    ): Promise<ChampionshipEntrant> => {
      const entrantId = await insert(
        `INSERT INTO championship_entrants (
          championshipId, entrantType, clubId, displayName, status
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          championshipId,
          data.entrantType,
          data.clubId || null,
          data.displayName,
          data.status || 'registered',
        ]
      );

      return {
        id: entrantId,
        championshipId,
        entrantType: data.entrantType as EntrantType,
        clubId: data.clubId || null,
        displayName: data.displayName as string,
        status: data.status || 'registered',
      };
    },

    getEntrantById: async (
      championshipId: number,
      entrantId: number
    ): Promise<ChampionshipEntrant | null> => {
      const rows = (await select(
        `SELECT id, championshipId, entrantType, clubId, displayName, status
         FROM championship_entrants
         WHERE championshipId = ? AND id = ?`,
        [championshipId, entrantId]
      )) as unknown as ChampionshipEntrant[];
      return rows[0] || null;
    },

    updateEntrant: async (
      championshipId: number,
      entrantId: number,
      data: Partial<ChampionshipEntrant>
    ) => {
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      const allowedFields: Array<keyof ChampionshipEntrant> = [
        'entrantType',
        'clubId',
        'displayName',
        'status',
      ];

      allowedFields.forEach((field) => {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(data[field] as string | number | null);
        }
      });

      if (fields.length === 0) {
        return { id: entrantId, championshipId, message: 'No changes provided' };
      }

      params.push(championshipId);
      params.push(entrantId);
      const affected = await update(
        `UPDATE championship_entrants
         SET ${fields.join(', ')}
         WHERE championshipId = ? AND id = ?`,
        params
      );

      if (affected === 0) {
        throw new Error('Entrant not found');
      }

      return {
        id: entrantId,
        championshipId,
        ...data,
      };
    },

    deleteEntrant: async (championshipId: number, entrantId: number) => {
      const affected = await update(
        `UPDATE championship_entrants
         SET status = 'withdrawn'
         WHERE championshipId = ? AND id = ?`,
        [championshipId, entrantId]
      );

      if (affected === 0) {
        throw new Error('Entrant not found');
      }

      return { id: entrantId, championshipId, message: 'Entrant withdrawn' };
    },

    addAmalgamationClub: async (
      championshipId: number,
      entrantId: number,
      clubId: number
    ) => {
      const entrants = (await select(
        `SELECT id, entrantType
         FROM championship_entrants
         WHERE championshipId = ? AND id = ?`,
        [championshipId, entrantId]
      )) as unknown as Array<{ id: number; entrantType: EntrantType }>;

      if (!entrants.length) {
        throw new Error('Entrant not found');
      }

      if (entrants[0].entrantType !== 'amalgamation') {
        throw new Error('Amalgamation clubs can only be added to amalgamation entrants');
      }

      await insert(
        `INSERT INTO amalgamation_clubs (entrantId, clubId)
         VALUES (?, ?)`,
        [entrantId, clubId]
      );

      return { entrantId, clubId, message: 'Club linked to amalgamation' };
    },

    listRounds: async (championshipId: number): Promise<RoundSummary[]> => {
      const rows = (await select(
        `SELECT t.roundNumber, t.id, t.Title, t.Date, t.status
         FROM tournaments t
         WHERE t.championshipId = ?
           AND t.roundNumber IS NOT NULL
         ORDER BY t.roundNumber ASC, t.Date ASC`,
        [championshipId]
      )) as unknown as Array<{
        roundNumber: number;
        id: number;
        Title: string;
        Date: string | null;
        status: string | null;
      }>;

      const map: Record<number, RoundSummary> = {};

      rows.forEach((row) => {
        if (!map[row.roundNumber]) {
          map[row.roundNumber] = {
            roundNumber: row.roundNumber,
            tournamentCount: 0,
            tournaments: [],
          };
        }

        map[row.roundNumber].tournamentCount += 1;
        map[row.roundNumber].tournaments.push({
          id: row.id,
          title: row.Title,
          date: row.Date,
          status: row.status,
        });
      });

      return Object.values(map).sort((a, b) => a.roundNumber - b.roundNumber);
    },

    getStandings: async (championshipId: number): Promise<StandingsRow[]> => {
      const entrants = (await select(
        `SELECT id, displayName
         FROM championship_entrants
         WHERE championshipId = ?
           AND status IN ('registered', 'active')
         ORDER BY displayName ASC`,
        [championshipId]
      )) as unknown as Array<{ id: number; displayName: string }>;

      return entrants.map((entrant) => ({
        entrantId: entrant.id,
        displayName: entrant.displayName,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
      }));
    },
  };
}

export = championshipsService;
