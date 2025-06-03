// Mock service for general endpoints
const { II, DD } = require('../../../lib/logging');

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("General mock service initialized");

  const mockTeams = [
    { id: 'T1', name: 'Mock Team Alpha', category: 'mens', stage: 'group', group: 1 },
    { id: 'T2', name: 'Mock Team Bravo', category: 'mens', stage: 'group', group: 1 },
  ];
  const mockPitches = [
    { id: 1, pitch: 'Mock Pitch 1', location: 'Near Gate', tournamentId: 1 },
    { id: 2, pitch: 'Mock Pitch 2', location: 'Far End', tournamentId: 1 },
  ];
  const mockStandingsData = [
    { team: 'Mock Team Alpha', played: 1, won: 1, drawn: 0, lost: 0, points: 3, category: 'mens', grp: 1 },
    { team: 'Mock Team Bravo', played: 1, won: 0, drawn: 0, lost: 1, points: 0, category: 'mens', grp: 1 },
  ];
  const mockGroups = [{ category: 'mens' }];


  return {
    listTeams: async (tournamentId, category, stage, group) => {
      II(`Mock: listTeams called for tId [${tournamentId}], category [${category}], stage [${stage}], group [${group}]`);
      // Simple filter for mock data
      const teams = mockTeams.filter(t => 
        (category ? t.category === category : true) &&
        (stage ? t.stage === stage : true) &&
        (group ? t.group === parseInt(group) : true)
      );
      DD("Mock: Returning teams:", teams);
      return Promise.resolve(teams);
    },

    listPitches: async (tournamentId) => {
      II(`Mock: listPitches called for tId [${tournamentId}]`);
      // Assuming all mock pitches belong to any requested tournamentId for simplicity
      DD("Mock: Returning pitches:", mockPitches);
      return Promise.resolve(mockPitches);
    },

    listStandings: async (tournamentId, category) => {
      II(`Mock: listStandings called for tId [${tournamentId}], category [${category}]`);
      const data = category ? mockStandingsData.filter(s => s.category === category) : mockStandingsData;
      const groups = category ? mockGroups.filter(g => g.category === category) : mockGroups;
      DD("Mock: Returning standings:", { groups, data });
      return Promise.resolve({ groups, data });
    },
  };
};
