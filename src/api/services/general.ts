import dbHelper = require('../../lib/db-helper');
import { sqlGroupStandings } from '../../lib/queries';

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

interface Standing {
  category: string;
  grp: string;
  team: string;
  tournamentId: number;
  MatchesPlayed: number;
  Wins: number;
  Draws: number;
  Losses: number;
  PointsFrom: number;
  PointsDifference: number;
  TotalPoints: number;
}

interface Pitch {
  id: number;
  pitch: string;
  location: string;
  type: string;
}

interface User {
  userId: number;
  name: string;
}

interface GeneralService {
  listTeams: (
    tournamentId: number | string,
    category?: string,
    stage?: string,
    group?: number | string
  ) => Promise<string[]>;
  listPitches: (tournamentId: number | string) => Promise<Pitch[]>;
  listStandings: (
    tournamentId: number | string,
    category?: string
  ) => Promise<{ groups: string[]; data: Standing[] }>;
  getUsers: (filter?: string) => Promise<User[]>;
}

function generalService(db: DbConnection): GeneralService {
  const { select } = dbHelper(db as any);
  const winAward = 3;

  return {
    /*
     * List teams for a given tournament, category, stage, and group number.
     * @param tournamentId - The ID of the tournament.
     * @param category - The category of the teams.
     * @param stage - can be "group", "playoffs", "knockout"
     * @param group -
     *    For "group", this will be a number.
     *    For "playoffs", this will be 0.
     *    For "knockout", this will be one of "cup", "shield", "plate", "bowl", "spoon".
     * @returns - A promise that resolves to an array of teams.
     */
    listTeams: async (
      tournamentId: number | string,
      category?: string,
      stage?: string,
      group?: number | string
    ): Promise<string[]> => {
      // normalize knockout group names
      let normGroup: number | string = group;
      if (stage === 'knockout' && typeof normGroup === 'string') {
        switch (normGroup.toLowerCase()) {
          case 'shield':
          case 'sld':
            normGroup = 'shd';
            break;
          case 'plate':
            normGroup = 'plt';
            break;
          case 'bowl':
            normGroup = 'bwl';
            break;
          case 'spoon':
            normGroup = 'spn';
            break;
          default:
            break;
        }
      }
      // build dynamic WHERE clause
      const conditions: string[] = ['tournamentId = ?'];
      const params: (string | number)[] = [tournamentId];
      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }
      if (stage === 'group') {
        conditions.push('stage = ?');
        params.push(stage);
        if (group != null) {
          conditions.push('groupNumber = ?');
          params.push(group);
        }
      } else if (stage === 'knockout') {
        conditions.push('stage LIKE ?');
        params.push(`${normGroup}%`);
      } else {
        conditions.push('stage = ?');
        params.push(stage || '');
      }
      const where = conditions.join(' AND ');
      const sql = `
        SELECT DISTINCT team FROM (
          SELECT team1Id as team FROM fixtures WHERE ${where}
          UNION
          SELECT team2Id as team FROM fixtures WHERE ${where}
        ) teams
      `;
      console.log('paarms', params);
      const teams = (await select(sql, [...params, ...params])) as unknown as {
        team: string;
      }[];
      return teams.map((t) => t.team).sort();
    },

    listPitches: async (tournamentId: number | string): Promise<Pitch[]> => {
      // Always get pitches from the pitches table directly to ensure we get all pitches
      // regardless of whether they have events in v_pitch_events
      const allPitches = (await select(
        `SELECT id, pitch, location, type FROM pitches WHERE tournamentId = ? ORDER BY pitch`,
        [tournamentId]
      )) as unknown as Pitch[];
      console.log(
        `[listPitches] Found ${allPitches.length} pitches for tournament ${tournamentId}:`,
        allPitches.map((p) => p.pitch)
      );
      return allPitches;
    },

    listStandings: async (
      tournamentId: number | string,
      category?: string
    ): Promise<{ groups: string[]; data: Standing[] }> => {
      const extra = category ? ` AND category = ?` : '';
      const params: (string | number)[] = category
        ? [tournamentId, category]
        : [tournamentId];
      const [groups, standings] = await Promise.all([
        select(
          `SELECT DISTINCT category FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`,
          params
        ) as Promise<unknown[]>,
        select(
          `SELECT * FROM ${sqlGroupStandings(winAward)} WHERE tournamentId = ? ${extra}`,
          params
        ) as Promise<unknown[]>,
      ]);
      return {
        groups: (groups as { category: string }[]).map((g) => g.category),
        data: standings as Standing[],
      };
    },

    getUsers: async (filter?: string): Promise<User[]> => {
      let query = `SELECT id as userId, Name as name FROM sec_users WHERE IsActive = 1`;
      const params: string[] = [];
      if (filter && filter.length >= 2) {
        query += ` AND LOWER(Name) LIKE LOWER(?)`;
        params.push(`%${filter}%`);
      }
      const users = (await select(query, params)) as unknown as User[];
      return users;
    },
  };
}

export = generalService;
