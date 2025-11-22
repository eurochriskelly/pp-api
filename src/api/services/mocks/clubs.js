// Mock service for clubs
const { II } = require('../../../lib/logging');

const mockClubs = [
  { clubId: 1, clubName: 'Amherst FC' },
  { clubId: 2, clubName: 'Amazon Warriors' },
  { clubId: 3, clubName: 'American Eagles' },
  { clubId: 4, clubName: 'Alpha Club' },
  { clubId: 5, clubName: 'Amber Stars' },
  { clubId: 6, clubName: 'Apex United' },
  { clubId: 7, clubName: 'Arsenal Juniors' },
  { clubId: 8, clubName: 'Atlanta Athletic' },
  { clubId: 9, clubName: 'Aurora FC' },
  { clubId: 10, clubName: 'Avengers SC' },
];

module.exports = () => {
  II('Clubs mock service initialized');
  return {
    listClubs: async (search, limit = 10) => {
      let filtered = mockClubs;
      if (search && search.length >= 2) {
        filtered = filtered.filter((club) =>
          club.clubName.toLowerCase().includes(search.toLowerCase())
        );
      }
      return filtered.slice(0, limit);
    },
  };
};
