import { II } from '../../../lib/logging';

interface MockSeries {
  id: number;
  name: string;
  description: string | null;
  sport: string | null;
  defaultSquadSize: number;
  defaultPlayersPerTeam: number;
  rulesetId: number | null;
  status: 'active' | 'inactive';
}

interface MockChampionship {
  id: number;
  seriesId: number;
  name: string;
  year: number;
  status: 'draft' | 'open' | 'in-progress' | 'completed' | 'archived';
}

const series: MockSeries[] = [
  {
    id: 1,
    name: 'Senior Football Series',
    description: 'Senior championship format',
    sport: 'football',
    defaultSquadSize: 15,
    defaultPlayersPerTeam: 15,
    rulesetId: null,
    status: 'active',
  },
  {
    id: 2,
    name: 'Senior Hurling Series',
    description: 'Senior hurling championship format',
    sport: 'hurling',
    defaultSquadSize: 15,
    defaultPlayersPerTeam: 15,
    rulesetId: null,
    status: 'active',
  },
];

const championships: MockChampionship[] = [
  {
    id: 1,
    seriesId: 1,
    name: 'Senior Football 2026',
    year: 2026,
    status: 'draft',
  },
  {
    id: 2,
    seriesId: 2,
    name: 'Senior Hurling 2026',
    year: 2026,
    status: 'open',
  },
];

let nextSeriesId = 3;

export default function mockSeriesService() {
  II('Series mock service initialized');

  return {
    listSeries: async (status?: string) => {
      if (!status) return series;
      return series.filter((s) => s.status === status);
    },

    getSeriesById: async (id: number) => {
      return series.find((s) => s.id === id) || null;
    },

    createSeries: async (data: Partial<MockSeries>) => {
      const row: MockSeries = {
        id: nextSeriesId++,
        name: data.name || '',
        description: data.description || null,
        sport: data.sport || null,
        defaultSquadSize: data.defaultSquadSize || 15,
        defaultPlayersPerTeam: data.defaultPlayersPerTeam || 15,
        rulesetId: data.rulesetId || null,
        status: data.status || 'active',
      };
      series.push(row);
      return row;
    },

    updateSeries: async (id: number, data: Partial<MockSeries>) => {
      const index = series.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Series not found');
      }

      series[index] = {
        ...series[index],
        ...data,
      };

      return series[index];
    },

    deleteSeries: async (id: number) => {
      const row = series.find((s) => s.id === id);
      if (!row) {
        throw new Error('Series not found');
      }

      row.status = 'inactive';
      return { id, message: 'Series deactivated' };
    },

    listSeriesChampionships: async (seriesId: number) => {
      return championships.filter((c) => c.seriesId === seriesId);
    },
  };
}
