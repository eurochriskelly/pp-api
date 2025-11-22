// Mock service for clubs
const { II } = require('../../../lib/logging');

const mockClubs = [
  { clubId: 1, Name: 'Amherst FC' },
  { clubId: 2, Name: 'Amazon Warriors' },
  { clubId: 3, Name: 'American Eagles' },
  { clubId: 4, Name: 'Alpha Club' },
  { clubId: 5, Name: 'Amber Stars' },
  { clubId: 6, Name: 'Apex United' },
  { clubId: 7, Name: 'Arsenal Juniors' },
  { clubId: 8, Name: 'Atlanta Athletic' },
  { clubId: 9, Name: 'Aurora FC' },
  { clubId: 10, Name: 'Avengers SC' },
];

module.exports = () => {
  II('Clubs mock service initialized');
  return {
    listClubs: async (search, limit = 10) => {
      let filtered = mockClubs.filter((club) => club.IsActive !== 0);
      if (search && search.length >= 2) {
        filtered = filtered.filter((club) =>
          club.Name.toLowerCase().includes(search.toLowerCase())
        );
      }
      return filtered.slice(0, limit);
    },
  };
};
