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

// Helper function for mocks, similar to the one in the actual service
function calculateMockLifecycleStatus(mockStatus, startDateString, endDateString) {
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

    // The mockStatus field in mockTournaments is already like 'upcoming', 'active', 'past'.
    // We need to map this, along with dates, to the four allowed lifecycle statuses.
    // Let's treat mockStatus as a proxy for dbStatus.
    let dbStatus = mockStatus; 

    // 1. Handle 'closed' equivalent status (mock 'past' often implies closed)
    if (dbStatus === 'past') { // Assuming mock 'past' means it's effectively closed for this calculation
        const threeMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 3));
        threeMonthsAgo.setHours(0,0,0,0);
        if (startDate < today && startDate >= threeMonthsAgo) return 'recent';
        if (startDate < threeMonthsAgo) return 'archive';
        // If mock 'past' but doesn't fit recent/archive (e.g., future start date, anomaly)
        if (startDate >= today) return 'upcoming';
        return 'archive'; // Default for other 'past' mock statuses
    }

    // 2. Handle 'upcoming' for non-closed statuses
    if ((dbStatus === 'upcoming' || dbStatus === 'new' || dbStatus === 'published' || dbStatus === 'in-design' || dbStatus === 'on-hold') && startDate >= today) {
        return 'upcoming';
    }

    // 3. Handle 'active' for non-closed statuses
    if ( (dbStatus === 'active' || dbStatus === 'new') && startDate < today && (!endDate || endDate >= today) ||
         ((dbStatus === 'published' || dbStatus === 'started' || dbStatus === 'in-design' || dbStatus === 'on-hold') && 
          startDate <= today && (!endDate || endDate >= today)) ) {
        return 'active';
    }
    
    // 4. Fallback logic for any dbStatus not explicitly resulting in 'recent', 'archive', 'upcoming', or 'active' above.
    if (startDate < today && endDate && endDate < today) {
        return 'archive';
    }
    if (startDate >= today) return 'upcoming';
    if (startDate < today && (!endDate || endDate >= today)) return 'active';
    
    return 'archive'; // Default for anything else
}


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
      const tournament = mockTournaments.find(t => 
        (id && t.id === id) || // mock IDs can be strings like 'pe-hurl-1'
        (id && t.id === parseInt(id)) || // or numbers if we mix
        (uuid && t.uuid === uuid)
      );
      if (tournament) {
        return {
          ...tournament,
          lifecycleStatus: calculateMockLifecycleStatus(tournament.status, tournament.startDate, tournament.endDate)
        };
      }
      return null;
    },

    getTournaments: async (statusQuery) => { // statusQuery is the original DB status filter, not lifecycle
      // The mock getTournaments doesn't currently filter by DB status, it returns all.
      // We'll add lifecycleStatus to each.
      return mockTournaments.map(t => ({
        ...t,
        lifecycleStatus: calculateMockLifecycleStatus(t.status, t.startDate, t.endDate)
      }));
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

    getTournamentsByStatus: async (requestedStatusString, userId, region) => {
      II(`Mock: getTournamentsByStatus for statuses [${requestedStatusString}], userId [${userId || 'N/A'}], region [${region || 'N/A'}]`);
      const requestedStatuses = requestedStatusString ? requestedStatusString.split(',').map(s => s.toLowerCase()) : [];
      
      // If no statuses are requested AND no region is specified, return empty.
      // If statuses are empty but region is specified, proceed to filter by region.
      if (requestedStatuses.length === 0 && !region) return [];


      const today = new Date(); today.setHours(0, 0, 0, 0);

      let filteredTournaments = mockTournaments;

      // Filter by region first if provided
      if (region) {
        filteredTournaments = filteredTournaments.filter(t => t.region && t.region.toLowerCase() === region.toLowerCase());
      }

      // Then filter by status if statuses are provided
      if (requestedStatuses.length > 0) {
        filteredTournaments = filteredTournaments.filter(t => {
        // Simplified mock status determination logic, as mock data already has 'upcoming', 'active', 'past'
        // This mock will primarily filter on the pre-assigned status in mockTournaments.
        // For a more accurate mock, replicate the full derivation logic from the real service.
        let tournamentMatchesRequestedStatus = false;

        const tStartDate = new Date(t.startDate); tStartDate.setHours(0,0,0,0);
        const tEndDate = t.endDate ? new Date(t.endDate) : null;
        if (tEndDate) tEndDate.setHours(0,0,0,0);

        // For filtering, calculate a status that aligns with the four target types
        let filterLifecycleStatus = calculateMockLifecycleStatus(t.status, t.startDate, t.endDate);

        if (requestedStatuses.includes(filterLifecycleStatus)) {
            tournamentMatchesRequestedStatus = true;
        }
        // The requestedStatuses array will contain 'active', 'upcoming', 'recent', 'archive'.
        // The calculateMockLifecycleStatus should correctly map to one of these, so direct check is fine.
        // No need for special 'recent'/'archive' checks here if filterLifecycleStatus is accurate.
        // However, if requestedStatuses contains 'past', that's an issue as 'past' is not a valid lifecycleStatus.
        // Assuming requestedStatuses only contains the four valid ones.

        // This block for 'recent'/'archive' specific filtering might be redundant if filterLifecycleStatus is comprehensive
        // and requestedStatuses only contains the four valid lifecycle states.
        // For example, if filterLifecycleStatus is 'recent', and 'recent' is in requestedStatuses, it matches.
        // If filterLifecycleStatus is 'archive', and 'archive' is in requestedStatuses, it matches.
        // Let's simplify assuming filterLifecycleStatus is the ground truth for matching.
        // The original logic for derivedStatus was trying to map t.status ('upcoming', 'active', 'past')
        // to the requested statuses, which could include 'recent'/'archive' that are not direct t.status values.
        // Using calculateMockLifecycleStatus for filtering simplifies this.
        if (requestedStatuses.includes(filterLifecycleStatus)) {
            tournamentMatchesRequestedStatus = true;
        }
        return tournamentMatchesRequestedStatus;
        });
      }


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
          status: t.status, // This is the original status from the mock data item
          lifecycleStatus: calculateMockLifecycleStatus(t.status, t.startDate, t.endDate), // Use the canonical mock calculator
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

    getTournamentsSummary: async () => {
      II(`Mock: getTournamentsSummary`);
      const summary = {};
      const today = new Date(); today.setHours(0, 0, 0, 0);

      mockTournaments.forEach(t => {
        if (!t.region) return; // Skip tournaments without a region

        if (!summary[t.region]) {
          summary[t.region] = { region: t.region, active: 0, upcoming: 0, recent: 0, archive: 0 };
        }

        const tStartDate = new Date(t.startDate); tStartDate.setHours(0, 0, 0, 0);
        // For mock, we rely on the pre-assigned status and dates.
        // The real service uses DB status and dates.
        // This mock logic tries to approximate the derivation.

        let derivedStatus = null;
        const dbStatus = t.status; // In mock, t.status is like 'upcoming', 'active', 'past'.
                                   // We need to simulate derivation from a hypothetical DB-like status.
                                   // For simplicity, let's assume mock 'status' field aligns with final derived status for non-closed.
                                   // For 'closed' (which is 'past' in mock), we check dates.

        if (dbStatus === 'past') { // Simulating 'closed'
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
            // Simplified active check for mock, assuming endDate logic is implicitly handled by 'active' status
            derivedStatus = 'active';
        } else if (tStartDate >= today) { // Fallback if mock status is not perfectly set
            derivedStatus = 'upcoming';
        } else { // Fallback for older items not explicitly 'past' (closed)
            derivedStatus = 'active'; // Or could be 'past' but we only count specific 'past' types
        }


        if (derivedStatus && summary[t.region][derivedStatus] !== undefined) {
          summary[t.region][derivedStatus]++;
        }
      });
      return Object.values(summary).sort((a, b) => a.region.localeCompare(b.region));
    },
  };
};
