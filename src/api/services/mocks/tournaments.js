const mockTournaments = [
  // Pan-Euro
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
  // Benelux
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
  // Central Europe
  {
    id: 'asia-1', // ID kept for consistency if it was referenced elsewhere, but content changed
    title: 'Central European Gaelic Challenge',
    region: 'Central Europe',
    sport: 'gaelic-football',
    location: 'Prague, Czech Republic',
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
    status: 'active',
    description: 'An exciting ongoing tournament in Central Europe.'
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
  // Another active tournament
  {
    id: 'active-generic-1',
    title: 'Ongoing European Shield',
    region: 'Pan-Euro', 
    sport: 'hurling',
    location: 'Various Cities',
    startDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0], 
    endDate: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split('T')[0], 
    status: 'active',
    description: 'A multi-day tournament currently active.'
  },
];

module.exports = () => {
  const { II } = require('../../../lib/logging'); // Ensure II is available if not already

  return {
    createTournament: async (tournament) => {
      const newTournament = {
        ...tournament,
        id: mockTournaments.length + 1
      };
      mockTournaments.push(newTournament);
      return newTournament.id;
    },

    getTournament: async (id, uuid) => {
      return mockTournaments.find(t => 
        t.id === parseInt(id) || (uuid && t.uuid === uuid)
      ) || null;
    },

    getTournaments: async (status) => {
      return mockTournaments;
    },

    updateTournament: async (id, updates) => {
      const index = mockTournaments.findIndex(t => t.id === parseInt(id));
      if (index >= 0) {
        mockTournaments[index] = {...mockTournaments[index], ...updates};
      }
    },

    deleteTournament: async (id) => {
      const index = mockTournaments.findIndex(t => t.id === parseInt(id));
      if (index >= 0) {
        mockTournaments.splice(index, 1);
      }
    },

    // Add other mocked service methods as needed
    buildTournamentReport: async (id) => {
      return {
        tournament: mockTournaments.find(t => t.id === parseInt(id)),
        stats: {
          matches: 10,
          teams: 8,
          players: 120
        }
      };
    },

    getFilters: async (tournamentId, role, category) => {
      II(`Mock: getFilters for tournament [${tournamentId}], role [${role}], category [${category || 'N/A'}]`);
      
      const competitionChoices = ['Mock Comp A', 'Mock Comp B', 'Mock Comp C'];
      const pitchChoices = ['Mock Pitch 1', 'Mock Pitch 2'];
      let teamChoices = [];
      if (category) {
        teamChoices = ['Mock Team X', 'Mock Team Y']; // Team names specific to category
      }
      // If category is not provided, teamChoices remains an empty array.
      const refereeChoices = ['Mock Ref Alpha', 'Mock Ref Beta']; // Mocking some refs

      const allMockFilters = {
        competition: {
          icon: 'CompIcon',
          category: 'Competition',
          choices: competitionChoices,
          allowMultiselect: true,
          selected: null,
          default: competitionChoices.length > 0 ? competitionChoices[0] : null
        },
        pitches: {
          icon: 'PitchIcon',
          category: 'Pitches',
          choices: pitchChoices,
          selected: [],
          allowMultiselect: true,
          default: null
        },
        teams: {
          icon: 'TeamIcon',
          category: 'Teams',
          choices: teamChoices,
          selected: [],
          allowMultiselect: true,
          default: null
        },
        referee: {
          icon: 'RefIcon',
          category: 'Referee',
          choices: refereeChoices,
          selected: null,
          allowMultiselect: false,
          default: null
        }
      };

      const roleFilterKeysMap = {
        organizer: ['competition', 'pitches', 'referee'],
        referee: ['competition', 'pitches', 'referee'],
        coach: ['competition', 'teams'],
        coordinator: ['pitches']
      };
      
      const roleFilterKeys = roleFilterKeysMap[role];

      if (!roleFilterKeys) {
        II(`Mock: Unknown role [${role}] for filters, returning empty array.`);
        return [];
      }
      return roleFilterKeys.map(key => allMockFilters[key]);
    },

    getTournamentsByStatus: async (requestedStatusString, userId) => {
      II(`Mock: getTournamentsByStatus for statuses [${requestedStatusString}], userId [${userId || 'N/A'}]`);
      const requestedStatuses = requestedStatusString ? requestedStatusString.split(',').map(s => s.toLowerCase()) : [];
      if (requestedStatuses.length === 0) return { data: [] };

      const today = new Date(); today.setHours(0, 0, 0, 0);

      const filteredTournaments = mockTournaments.filter(t => {
        // Simplified mock status determination logic, as mock data already has 'upcoming', 'active', 'past'
        // This mock will primarily filter on the pre-assigned status in mockTournaments.
        // For a more accurate mock, replicate the full derivation logic from the real service.
        let tournamentMatchesRequestedStatus = false;

        const tStartDate = new Date(t.startDate); tStartDate.setHours(0,0,0,0);
        const tEndDate = t.endDate ? new Date(t.endDate) : null;
        if (tEndDate) tEndDate.setHours(0,0,0,0);

        let derivedStatus;
        // A simplified derivation for mock, actual service has more complex DB status mapping
        if (t.status === 'upcoming' && tStartDate >= today) derivedStatus = 'upcoming';
        else if (t.status === 'active' && tStartDate <= today && (!tEndDate || tEndDate >= today)) derivedStatus = 'active';
        else if (t.status === 'past' && (tEndDate ? tEndDate < today : tStartDate < today)) derivedStatus = 'past';
        else { // Fallback for mocks if status field isn't perfectly aligned
            if (tStartDate >= today) derivedStatus = 'upcoming';
            else if (!tEndDate || tEndDate >= today) derivedStatus = 'active';
            else derivedStatus = 'past';
        }


        if (requestedStatuses.includes(derivedStatus)) {
            tournamentMatchesRequestedStatus = true;
        }
        
        if (requestedStatuses.includes('recent') && derivedStatus === 'past') {
            const threeMonthsAgo = new Date(today);
            threeMonthsAgo.setMonth(today.getMonth() - 3);
            if (tStartDate >= threeMonthsAgo && tStartDate < today) tournamentMatchesRequestedStatus = true;
            else if (!requestedStatuses.includes('past')) tournamentMatchesRequestedStatus = false; // Don't match if only 'recent' is asked and this is older 'past'
        }
        if (requestedStatuses.includes('archive') && derivedStatus === 'past') {
            const threeMonthsAgo = new Date(today);
            threeMonthsAgo.setMonth(today.getMonth() - 3);
            if (tStartDate < threeMonthsAgo) tournamentMatchesRequestedStatus = true;
            else if (!requestedStatuses.includes('past')) tournamentMatchesRequestedStatus = false; // Don't match if only 'archive' is asked and this is newer 'past'
        }
        return tournamentMatchesRequestedStatus;
      });

      return filteredTournaments.map((t, index) => {
        let isUserAssociated = null;
        if (userId) {
          // Mock logic: user is associated with every second tournament for testing
          isUserAssociated = index % 2 === 0;
        }
        
        // Map to the Tournament interface
        return {
          id: String(t.id), // Assuming mock id can be number or string
          title: t.title,
          region: t.region,
          location: t.location,
          startDate: t.startDate, // Assuming YYYY-MM-DD
          endDate: t.endDate,   // Assuming YYYY-MM-DD or undefined
          status: t.status, // Mock status is already 'upcoming', 'active', or 'past'
          season: t.season || String(new Date(t.startDate).getFullYear()), // Mock season or derive
          sport: t.sport, // 'hurling' | 'gaelic-football'
          uuid: t.uuid,
          description: t.description, // Mock data might have description
          isUserAssociated: isUserAssociated,
          latitude: t.latitude,
          longitude: t.longitude,
        };
      });
    },
  };
};
