import { v4 as uuidv4 } from 'uuid';
import { II, DD } from '../../lib/logging';
import dbHelper from '../../lib/db-helper';

// Helper function to calculate lifecycle status
function calculateLifecycleStatus(dbStatus: string, startDateString: string, endDateString: string | null): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!startDateString) return 'unknown';

  const startDate = new Date(startDateString);
  startDate.setHours(0, 0, 0, 0);

  let endDate = null;
  if (endDateString) {
    endDate = new Date(endDateString);
    endDate.setHours(0, 0, 0, 0);
  }

  if (dbStatus === 'closed') {
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    if (startDate < today && startDate >= threeMonthsAgo) return 'recent';
    if (startDate < threeMonthsAgo) return 'archive';
    return 'past';
  }

  if (dbStatus === 'new' || dbStatus === 'published' || dbStatus === 'in-design') {
    if (startDate >= today) return 'upcoming';
    if (!endDate || endDate >= today) return 'active';
    return 'past';
  }

  if (dbStatus === 'started') {
    if (!endDate || endDate >= today) return 'active';
  }

  if (dbStatus === 'on-hold') {
    if (startDate >= today) return 'upcoming';
    if (!endDate || endDate >= today) return 'active';
  }

  if (startDate < today && endDate && endDate < today) {
    return 'archive';
  }

  if (startDate >= today) return 'upcoming';
  if (startDate < today && (!endDate || endDate >= today)) return 'active';

  return 'archive';
}

export default (db: any) => {
  const { select, insert, update, delete: dbDelete } = dbHelper(db);
  const winAward = 2;

  const getTournament = async (id?: number | string, uuid?: string) => {
    if (!id && !uuid) {
      throw new Error('Either id or uuid must be provided');
    }

    let query = 'SELECT * FROM tournaments WHERE';
    const params = [];

    if (id) {
      query += ' id = ?';
      params.push(id);
    } else if (uuid) {
      query += ' eventUuid = ?';
      params.push(uuid);
    }

    const tournaments = await select(query, params);
    if (tournaments.length === 0) {
      return null;
    }

    const tournament = tournaments[0];
    const mappedTournament = {
      id: tournament.id,
      date: tournament.Date,
      endDate: tournament.endDate,
      title: tournament.Title,
      location: tournament.Location,
      lat: tournament.Lat,
      lon: tournament.Lon,
      code: tournament.code,
      uuid: tournament.eventUuid,
      status: tournament.status,
      lifecycleStatus: calculateLifecycleStatus(tournament.status, tournament.Date, tournament.endDate),
    };

    return mappedTournament;
  };

  return {
    codeCheck: async (tournamentId: number, code: string, role: string): Promise<boolean> => {
      // Implementation
      return true;
    },

    validateTsv: (tsvEncoded: string) => {
      // Implementation
      return {};
    },

    buildTournamentReport: async (tournamentId: number) => {
      // Implementation
      return {};
    },

    createTournament: async (userId: number, data: any) => {
      // Implementation
      return {};
    },

    getTournaments: async (status: string = 'all', userId?: number, role?: string) => {
      // Implementation
      return [];
    },

    getTournament,

    updateTournament: async (id: number, data: any) => {
      // Implementation
    },

    generateFixtures: async (data: any) => {
      // Implementation
    },

    getFilters: async (tournamentId: number, role: string, category: string) => {
      // Implementation
    },

    deleteTournament: async (id: number) => {
      // Implementation
    },

    resetTournament: async (id: number) => {
      // Implementation
    },

    createSquad: async (tournamentId: number, data: any) => {
      // Implementation
    },

    getSquad: async (tournamentId: number, id: number) => {
      // Implementation
    },

    getTournamentsByStatus: async (status: string, userId?: number, region?: string) => {
      // Implementation
      return [];
    },

    getTournamentsSummary: async () => {
      // Implementation
      return [];
    },
  };
};