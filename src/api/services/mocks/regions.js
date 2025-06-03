// Mock service for regions
const { II, DD } = require('../../../lib/logging');

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("Regions mock service initialized");

  const mockRegions = [
    "Pan-Euro",
    "Benelux",
    "North/West",
    "Central/East",
    "Iberia"
  ];
  const mockRegionInfoData = {
    "Pan-Euro": {
      clubs: [{ id: 1, name: "Mock Club Pan-Euro A" }],
      stats: { count: 1 }
    },
    "Benelux": {
      clubs: [{ id: 2, name: "Mock Club Benelux B" }],
      stats: { count: 1 }
    }
  };

  return {
    listRegions: async () => {
      II("Mock: listRegions called");
      DD("Mock: Returning regions:", mockRegions);
      return Promise.resolve(mockRegions);
    },

    listRegionInfo: async (region, { sex, sport, level }) => {
      II(`Mock: listRegionInfo called for region [${region}] with filters:`, { sex, sport, level });
      // Basic mock: return pre-defined data or a default if not found
      const data = mockRegionInfoData[region] || { clubs: [], stats: { count: 0, message: `No mock data for ${region}` }};
      DD("Mock: Returning region info:", data);
      return Promise.resolve(data);
    },
  };
};
