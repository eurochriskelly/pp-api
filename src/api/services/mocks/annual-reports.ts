// Mock service for annual reports
import { II, DD } from '../../../lib/logging';

interface YearSummary {
  year: number;
  tournaments: number;
  matches: number;
  teams: number;
}

interface AnnualReport {
  year: number;
  summary: {
    totalTournaments: number;
    totalMatches: number;
    totalTeams: number;
    totalRegions: number;
    avgMatchesPerTournament: number;
    winMarginStats: { avg: number; max: number };
  };
  monthlyMatches: { month: string; count: number }[];
  topRegions: { region: string; tournaments: number; matches: number }[];
  topSports: { sport: string; tournaments: number }[];
  tournaments: {
    id: number;
    name: string;
    date: string;
    sport: string;
    matches: number;
    teams: number;
    region: string;
  }[];
}

const mockYearsSummary: YearSummary[] = [
  { year: 2025, tournaments: 12, matches: 340, teams: 48 },
  { year: 2024, tournaments: 10, matches: 280, teams: 42 },
  { year: 2023, tournaments: 8, matches: 210, teams: 36 },
];

const mockAnnualReports: Record<number, AnnualReport> = {
  2025: {
    year: 2025,
    summary: {
      totalTournaments: 12,
      totalMatches: 340,
      totalTeams: 48,
      totalRegions: 6,
      avgMatchesPerTournament: 28.3,
      winMarginStats: { avg: 4.2, max: 12 },
    },
    monthlyMatches: [
      { month: 'Jan', count: 0 },
      { month: 'Feb', count: 0 },
      { month: 'Mar', count: 0 },
      { month: 'Apr', count: 20 },
      { month: 'May', count: 80 },
      { month: 'Jun', count: 120 },
      { month: 'Jul', count: 60 },
      { month: 'Aug', count: 40 },
      { month: 'Sep', count: 20 },
      { month: 'Oct', count: 0 },
      { month: 'Nov', count: 0 },
      { month: 'Dec', count: 0 },
    ],
    topRegions: [
      { region: 'Pan-Euro', tournaments: 5, matches: 150 },
      { region: 'North', tournaments: 3, matches: 90 },
      { region: 'South', tournaments: 2, matches: 60 },
      { region: 'East', tournaments: 1, matches: 25 },
      { region: 'West', tournaments: 1, matches: 15 },
    ],
    topSports: [
      { sport: 'hurling', tournaments: 7 },
      { sport: 'football', tournaments: 3 },
      { sport: 'camogie', tournaments: 2 },
    ],
    tournaments: [
      {
        id: 1,
        name: 'Mock Tournament 1',
        date: '2025-06-01',
        sport: 'hurling',
        matches: 30,
        teams: 12,
        region: 'Pan-Euro',
      },
      {
        id: 2,
        name: 'Mock Tournament 2',
        date: '2025-06-15',
        sport: 'football',
        matches: 28,
        teams: 10,
        region: 'North',
      },
    ],
  },
};

export default function mockAnnualReportsService() {
  II('Annual reports mock service initialized');

  return {
    getYearsSummary: async (): Promise<YearSummary[]> => {
      II('Mock: getYearsSummary called');
      DD(`Mock: Returning ${mockYearsSummary.length} year summaries`);
      return [...mockYearsSummary];
    },

    getAnnualReport: async (year: number): Promise<AnnualReport> => {
      II(`Mock: getAnnualReport called for year [${year}]`);
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error('Invalid year');
      }
      const report = mockAnnualReports[year];
      if (!report) {
        throw new Error('No data found for year');
      }
      DD(`Mock: Returning annual report for ${year}`);
      return { ...report };
    },
  };
}

export type MockAnnualReportsService = ReturnType<typeof mockAnnualReportsService>;
