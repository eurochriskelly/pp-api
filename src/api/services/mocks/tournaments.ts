import { II } from '../../../lib/logging';
import { generateFixturesForCompetition } from '../tournaments/generate-fixtures';

export interface MockTournament {
  id: string;
  title: string;
  region: string;
  sport: string;
  location: string;
  startDate: string;
  endDate?: string;
  status: string;
  description?: string;
  season?: string;
  uuid?: string;
  latitude?: number;
  longitude?: number;
}

const mockTournaments: MockTournament[] = [
  {
    id: 'pe-hurl-1',
    title: 'Hurling Round 3',
    region: 'Pan-Euro',
    sport: 'hurling',
    location: 'Zurich, Switzerland',
    startDate: '2025-06-07',
    status: 'upcoming',
  },
  {
    id: 'pe-hurl-2',
    title: 'Hurling Round 4',
    region: 'Pan-Euro',
    sport: 'hurling',
    location: 'Vienna, Austria',
    startDate: '2025-07-03',
    status: 'upcoming',
  },
  {
    id: 'pe-hurl-3',
    title: 'PanEuro Championships',
    region: 'Pan-Euro',
    sport: 'hurling',
    location: 'Dresden, Germany',
    startDate: '2025-09-20',
    endDate: '2025-09-21',
    status: 'upcoming',
  },
  {
    id: 'pe-hurl-4',
    title: 'Old PanEuro Tournament',
    region: 'Pan-Euro',
    sport: 'hurling',
    location: 'Copenhagen, Denmark',
    startDate: '2024-05-10',
    status: 'past',
  },
  {
    id: 'bene-1',
    title: 'Benelux Round 3',
    region: 'Benelux',
    sport: 'gaelic-football',
    location: 'Luxembourg City, Luxembourg',
    startDate: '2025-07-08',
    status: 'upcoming',
  },
  {
    id: 'bene-2',
    title: 'Amsterdam Ladies Football Blitz',
    region: 'Benelux',
    sport: 'gaelic-football',
    location: 'Amsterdam, Netherlands',
    startDate: '2025-08-15',
    status: 'upcoming',
  },
  {
    id: 'asia-1',
    title: 'Central European Gaelic Challenge',
    region: 'Central Europe',
    sport: 'gaelic-football',
    location: 'Prague, Czech Republic',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 1))
      .toISOString()
      .split('T')[0],
    status: 'active',
    description: 'An exciting ongoing tournament in Central Europe.',
  },
  {
    id: 'asia-2',
    title: 'Berlin Gaelic Masters',
    region: 'Central Europe',
    sport: 'gaelic-football',
    location: 'Berlin, Germany',
    startDate: '2025-10-05',
    status: 'upcoming',
  },
  {
    id: 'asia-3',
    title: 'Warsaw Gaelic Games',
    region: 'Central Europe',
    sport: 'gaelic-football',
    location: 'Warsaw, Poland',
    startDate: '2024-04-20',
    status: 'past',
  },
  {
    id: 'active-generic-1',
    title: 'Ongoing European Shield',
    region: 'Pan-Euro',
    sport: 'hurling',
    location: 'Various Cities',
    startDate: new Date(new Date().setDate(new Date().getDate() - 1))
      .toISOString()
      .split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 2))
      .toISOString()
      .split('T')[0],
    status: 'active',
    description: 'A multi-day tournament currently active.',
  },
];

function calculateMockLifecycleStatus(
  mockStatus: string,
  startDateString: string,
  endDateString?: string
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!startDateString) return 'unknown';

  const startDate = new Date(startDateString);
  startDate.setHours(0, 0, 0, 0);

  let endDate: Date | null = null;
  if (endDateString) {
    endDate = new Date(endDateString);
    endDate.setHours(0, 0, 0, 0);
  }

  let dbStatus = mockStatus;

  if (dbStatus === 'past') {
    const threeMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 3));
    threeMonthsAgo.setHours(0, 0, 0, 0);
    if (startDate < today && startDate >= threeMonthsAgo) return 'recent';
    if (startDate < threeMonthsAgo) return 'archive';
    if (startDate >= today) return 'upcoming';
    return 'archive';
  }

  if (
    (dbStatus === 'upcoming' ||
      dbStatus === 'new' ||
      dbStatus === 'published' ||
      dbStatus === 'in-design' ||
      dbStatus === 'on-hold') &&
    startDate >= today
  ) {
    return 'upcoming';
  }

  if (
    ((dbStatus === 'active' || dbStatus === 'new') &&
      startDate < today &&
      (!endDate || endDate >= today)) ||
    ((dbStatus === 'published' ||
      dbStatus === 'started' ||
      dbStatus === 'in-design' ||
      dbStatus === 'on-hold') &&
      startDate <= today &&
      (!endDate || endDate >= today))
  ) {
    return 'active';
  }

  if (startDate < today && endDate && endDate < today) {
    return 'archive';
  }
  if (startDate >= today) return 'upcoming';
  if (startDate < today && (!endDate || endDate >= today)) return 'active';

  return 'archive';
}

export default function mockTournamentsService() {
  return {
    createTournament: async (tournament: any) => {
      const newTournament = {
        ...tournament,
        id: mockTournaments.length + 1,
      };
      mockTournaments.push(newTournament as MockTournament);
      return newTournament.id;
    },

    publishTournamentArchive: async ({
      archiveBuffer,
    }: {
      archiveBuffer: Buffer;
    }) => {
      let eventUuid: string | null = null;
      let tournamentId: string | null = null;

      try {
        const text = archiveBuffer.toString('utf8');
        const maybePayload = JSON.parse(text);
        eventUuid = maybePayload?.tournament?.eventUuid || null;
        tournamentId = maybePayload?.tournament?.id || null;
      } catch {
        // In mock mode we accept opaque buffers and return placeholder metadata.
      }

      return {
        id: Date.now(),
        eventUuid,
        tournamentId,
      };
    },

    getTournament: async (id?: string | number, uuid?: string) => {
      const tournament = mockTournaments.find(
        (t) =>
          (id && t.id === id) ||
          (id && t.id === String(id)) ||
          (uuid && t.uuid === uuid)
      );
      if (tournament) {
        return {
          ...tournament,
          lifecycleStatus: calculateMockLifecycleStatus(
            tournament.status,
            tournament.startDate,
            tournament.endDate
          ),
        };
      }
      return null;
    },

    getTournaments: async () => {
      return mockTournaments.map((t) => ({
        ...t,
        lifecycleStatus: calculateMockLifecycleStatus(
          t.status,
          t.startDate,
          t.endDate
        ),
      }));
    },

    updateTournament: async (id: string | number, updates: any) => {
      const index = mockTournaments.findIndex((t) => t.id === String(id));
      if (index >= 0) {
        mockTournaments[index] = { ...mockTournaments[index], ...updates };
      }
    },

    deleteTournament: async (id: string | number) => {
      const index = mockTournaments.findIndex((t) => t.id === String(id));
      if (index >= 0) {
        mockTournaments.splice(index, 1);
      }
    },

    buildTournamentReport: async (id: string | number) => {
      return {
        tournament: mockTournaments.find((t) => t.id === String(id)),
        stats: {
          matches: 10,
          teams: 8,
          players: 120,
        },
      };
    },

    generateFixtures: async (competition: any) => {
      II(`Mock: Generating fixtures for competition [${competition.name}]`);
      const hydratedCompetition = generateFixturesForCompetition(competition);
      return Promise.resolve(hydratedCompetition);
    },

    getFilters: async (
      tournamentId: string | number,
      role: string,
      category?: string
    ) => {
      II(
        `Mock: getFilters for tournament [${tournamentId}], role [${role}], category [${category || 'N/A'}]`
      );

      const competitionChoices = ['Mock Comp A', 'Mock Comp B', 'Mock Comp C'];
      const pitchChoices = ['Mock Pitch 1', 'Mock Pitch 2'];
      let teamChoices: string[] = [];
      if (category) {
        teamChoices = ['Mock Team X', 'Mock Team Y'];
      }
      const refereeChoices = ['Mock Ref Alpha', 'Mock Ref Beta'];

      const allMockFilters: { [key: string]: any } = {
        competition: {
          icon: 'CompIcon',
          category: 'Competition',
          choices: competitionChoices,
          allowMultiselect: true,
          selected: null,
          default: competitionChoices.length > 0 ? competitionChoices[0] : null,
        },
        pitches: {
          icon: 'PitchIcon',
          category: 'Pitches',
          choices: pitchChoices,
          selected: [],
          allowMultiselect: true,
          default: null,
        },
        teams: {
          icon: 'TeamIcon',
          category: 'Teams',
          choices: teamChoices,
          selected: [],
          allowMultiselect: true,
          default: null,
        },
        referee: {
          icon: 'RefIcon',
          category: 'Referee',
          choices: refereeChoices,
          selected: null,
          allowMultiselect: false,
          default: null,
        },
      };

      const roleFilterKeysMap: { [key: string]: string[] } = {
        organizer: ['competition', 'pitches', 'referee'],
        referee: ['competition', 'pitches', 'referee'],
        coach: ['competition', 'teams'],
        coordinator: ['pitches'],
      };

      const roleFilterKeys = roleFilterKeysMap[role];

      if (!roleFilterKeys) {
        II(`Mock: Unknown role [${role}] for filters, returning empty array.`);
        return [];
      }
      return roleFilterKeys.map((key) => allMockFilters[key]);
    },

    getTournamentsByStatus: async (
      requestedStatusString: string,
      userId?: string,
      region?: string
    ) => {
      II(
        `Mock: getTournamentsByStatus for statuses [${requestedStatusString}], userId [${userId || 'N/A'}], region [${region || 'N/A'}]`
      );
      const requestedStatuses = requestedStatusString
        ? requestedStatusString.split(',').map((s) => s.toLowerCase())
        : [];

      if (requestedStatuses.length === 0 && !region) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let filteredTournaments = mockTournaments;

      if (region) {
        filteredTournaments = filteredTournaments.filter(
          (t) => t.region && t.region.toLowerCase() === region.toLowerCase()
        );
      }

      if (requestedStatuses.length > 0) {
        filteredTournaments = filteredTournaments.filter((t) => {
          const filterLifecycleStatus = calculateMockLifecycleStatus(
            t.status,
            t.startDate,
            t.endDate
          );
          return requestedStatuses.includes(filterLifecycleStatus);
        });
      }

      return filteredTournaments.map((t, index) => {
        let isUserAssociated: boolean | null = null;
        if (userId) {
          isUserAssociated = index % 2 === 0;
        }

        return {
          id: String(t.id),
          title: t.title,
          region: t.region,
          location: t.location,
          startDate: t.startDate,
          endDate: t.endDate,
          status: t.status,
          lifecycleStatus: calculateMockLifecycleStatus(
            t.status,
            t.startDate,
            t.endDate
          ),
          season: t.season || String(new Date(t.startDate).getFullYear()),
          sport: t.sport,
          uuid: t.uuid,
          description: t.description,
          isUserAssociated: isUserAssociated,
          latitude: t.latitude,
          longitude: t.longitude,
        };
      });
    },

    getTournamentsSummary: async () => {
      II(`Mock: getTournamentsSummary`);
      const summary: { [key: string]: any } = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      mockTournaments.forEach((t) => {
        if (!t.region) return;

        if (!summary[t.region]) {
          summary[t.region] = {
            region: t.region,
            active: 0,
            upcoming: 0,
            recent: 0,
            archive: 0,
          };
        }

        const tStartDate = new Date(t.startDate);
        tStartDate.setHours(0, 0, 0, 0);

        let derivedStatus: string | null = null;
        const dbStatus = t.status;

        if (dbStatus === 'past') {
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setMonth(today.getMonth() - 3);
          if (tStartDate >= threeMonthsAgo && tStartDate < today) {
            derivedStatus = 'recent';
          } else if (tStartDate < threeMonthsAgo) {
            derivedStatus = 'archive';
          }
        } else if (dbStatus === 'upcoming' && tStartDate >= today) {
          derivedStatus = 'upcoming';
        } else if (dbStatus === 'active' && tStartDate <= today) {
          derivedStatus = 'active';
        } else if (tStartDate >= today) {
          derivedStatus = 'upcoming';
        } else {
          derivedStatus = 'active';
        }

        if (derivedStatus && summary[t.region][derivedStatus] !== undefined) {
          summary[t.region][derivedStatus]++;
        }
      });
      return Object.values(summary).sort((a: any, b: any) =>
        a.region.localeCompare(b.region)
      );
    },

    uploadTeamsheet: async (
      tournamentId: string | number,
      clubId: string | number,
      intakeForm: any,
      intakePeople: any
    ) => {
      II(
        `Mock: uploadTeamsheet for tournament [${tournamentId}], club [${clubId}]`
      );
      return { success: true, intakeForm, intakePeople };
    },

    getTournamentClubs: async () => {
      return [];
    },
  };
}

export type MockTournamentsService = ReturnType<typeof mockTournamentsService>;
