import { II } from '../../../lib/logging';

type ChampionshipStatus =
  | 'draft'
  | 'open'
  | 'in-progress'
  | 'completed'
  | 'archived';

type EntrantType = 'club' | 'amalgamation';

interface MockChampionship {
  id: number;
  seriesId: number;
  name: string;
  year: number;
  numRounds: number;
  squadSize: number | null;
  playersPerTeam: number | null;
  status: ChampionshipStatus;
}

interface MockEntrant {
  id: number;
  championshipId: number;
  entrantType: EntrantType;
  clubId: number | null;
  displayName: string;
  status: 'registered' | 'withdrawn' | 'active';
}

const championships: MockChampionship[] = [
  {
    id: 1,
    seriesId: 1,
    name: 'Senior Football 2026',
    year: 2026,
    numRounds: 4,
    squadSize: null,
    playersPerTeam: null,
    status: 'draft',
  },
  {
    id: 2,
    seriesId: 2,
    name: 'Senior Hurling 2026',
    year: 2026,
    numRounds: 4,
    squadSize: 18,
    playersPerTeam: 15,
    status: 'open',
  },
];

const entrants: MockEntrant[] = [
  {
    id: 1,
    championshipId: 1,
    entrantType: 'club',
    clubId: 101,
    displayName: 'Amsterdam GAC',
    status: 'registered',
  },
  {
    id: 2,
    championshipId: 1,
    entrantType: 'amalgamation',
    clubId: null,
    displayName: 'Paris-Bordeaux Amalgamation',
    status: 'active',
  },
];

let nextChampionshipId = 3;
let nextEntrantId = 3;
const amalgamationClubs: Array<{ entrantId: number; clubId: number }> = [];

export default function mockChampionshipsService() {
  II('Championships mock service initialized');

  return {
    listChampionships: async ({
      seriesId,
      year,
      status,
    }: {
      seriesId?: unknown;
      year?: unknown;
      status?: unknown;
    }) => {
      return championships.filter((row) => {
        if (
          seriesId !== undefined &&
          row.seriesId !== parseInt(seriesId as string, 10)
        ) {
          return false;
        }
        if (year !== undefined && row.year !== parseInt(year as string, 10)) {
          return false;
        }
        if (status !== undefined && row.status !== status) {
          return false;
        }
        return true;
      });
    },

    getChampionshipById: async (id: number) => {
      return championships.find((row) => row.id === id) || null;
    },

    createChampionship: async (data: Partial<MockChampionship>) => {
      const row: MockChampionship = {
        id: nextChampionshipId++,
        seriesId: data.seriesId as number,
        name: data.name as string,
        year: data.year as number,
        numRounds: data.numRounds || 4,
        squadSize: data.squadSize || null,
        playersPerTeam: data.playersPerTeam || null,
        status: data.status || 'draft',
      };
      championships.push(row);
      return row;
    },

    updateChampionship: async (id: number, data: Partial<MockChampionship>) => {
      const index = championships.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error('Championship not found');
      }

      championships[index] = {
        ...championships[index],
        ...data,
      };

      return championships[index];
    },

    deleteChampionship: async (id: number) => {
      const row = championships.find((c) => c.id === id);
      if (!row) {
        throw new Error('Championship not found');
      }

      row.status = 'archived';
      return { id, message: 'Championship archived' };
    },

    listEntrants: async (championshipId: number) => {
      return entrants.filter((row) => row.championshipId === championshipId);
    },

    createEntrant: async (championshipId: number, data: Partial<MockEntrant>) => {
      const row: MockEntrant = {
        id: nextEntrantId++,
        championshipId,
        entrantType: data.entrantType as EntrantType,
        clubId: data.clubId || null,
        displayName: data.displayName as string,
        status: data.status || 'registered',
      };
      entrants.push(row);
      return row;
    },

    getEntrantById: async (championshipId: number, entrantId: number) => {
      return (
        entrants.find(
          (row) => row.championshipId === championshipId && row.id === entrantId
        ) || null
      );
    },

    updateEntrant: async (
      championshipId: number,
      entrantId: number,
      data: Partial<MockEntrant>
    ) => {
      const index = entrants.findIndex(
        (row) => row.championshipId === championshipId && row.id === entrantId
      );
      if (index === -1) {
        throw new Error('Entrant not found');
      }

      entrants[index] = {
        ...entrants[index],
        ...data,
      };

      return entrants[index];
    },

    deleteEntrant: async (championshipId: number, entrantId: number) => {
      const row = entrants.find(
        (entrant) =>
          entrant.championshipId === championshipId && entrant.id === entrantId
      );
      if (!row) {
        throw new Error('Entrant not found');
      }

      row.status = 'withdrawn';
      return { id: entrantId, championshipId, message: 'Entrant withdrawn' };
    },

    addAmalgamationClub: async (
      championshipId: number,
      entrantId: number,
      clubId: number
    ) => {
      const row = entrants.find(
        (entrant) =>
          entrant.championshipId === championshipId && entrant.id === entrantId
      );
      if (!row) {
        throw new Error('Entrant not found');
      }
      if (row.entrantType !== 'amalgamation') {
        throw new Error(
          'Amalgamation clubs can only be added to amalgamation entrants'
        );
      }

      const exists = amalgamationClubs.find(
        (ac) => ac.entrantId === entrantId && ac.clubId === clubId
      );
      if (!exists) {
        amalgamationClubs.push({ entrantId, clubId });
      }

      return { entrantId, clubId, message: 'Club linked to amalgamation' };
    },

    listRounds: async (championshipId: number) => {
      if (championshipId !== 1) {
        return [];
      }

      return [
        {
          roundNumber: 1,
          tournamentCount: 1,
          tournaments: [
            {
              id: 1001,
              title: 'Amsterdam Round 1',
              date: '2026-04-12',
              status: 'published',
            },
          ],
        },
      ];
    },

    getStandings: async (championshipId: number) => {
      return entrants
        .filter((row) => row.championshipId === championshipId)
        .map((entrant) => ({
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
