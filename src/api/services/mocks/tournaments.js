const mockTournaments = [
  {
    id: 1,
    title: "Mock Tournament 1",
    date: "2023-06-15",
    location: "Mock Location",
    lat: 53.3498,
    lon: -6.2603,
    uuid: "550e8400-e29b-41d4-a716-446655440000"
  },
  {
    id: 2,
    title: "Mock Tournament 2",
    date: "2023-07-20",
    location: "Another Mock Location",
    lat: 51.5074,
    lon: -0.1278,
    uuid: "550e8400-e29b-41d4-a716-446655440001"
  }
];

module.exports = () => {
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
    }
  };
};
