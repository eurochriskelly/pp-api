// Mock service for regions
const { II, DD } = require('../../../lib/logging');

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("Regions mock service initialized");

  const mockRegions = [
    { id: 'paneuro', name: 'Pan-Euro' },
    { id: 'benelux', name: 'Benelux' },
    { id: 'northwest', name: 'North/West' },
    { id: 'centraleast', name: 'Central/East' },
    { id: 'iberia', name: 'Iberia' }
  ];
  const mockRegionInfoData = {
    "paneuro": {
      clubs: [{ id: 1, name: "Mock Club Pan-Euro A" }],
      stats: { count: 1 }
    },
    "benelux": {
      clubs: [{ id: 2, name: "Mock Club Benelux B" }],
      stats: { count: 1 }
    },
    // Add mock data for other regions if needed, or they will default
    // to empty clubs and a message in listRegionInfo.
    "northwest": {
      clubs: [{ id: 3, name: "Mock Club North/West C" }],
      stats: { count: 1 }
    },
    "centraleast": {
      clubs: [{ id: 4, name: "Mock Club Central/East D" }],
      stats: { count: 1 }
    },
    "iberia": {
      clubs: [{ id: 5, name: "Mock Club Iberia E" }],
      stats: { count: 1 }
    }
  };

  return {
    listRegions: async () => {
      II("Mock: listRegions called");
      DD("Mock: Returning regions:", mockRegions);
      return Promise.resolve(mockRegions);
    },

    listRegionInfo: async (regionIdentifier, { sex, sport, level }) => {
      II(`Mock: listRegionInfo called for region/ID [${regionIdentifier}] with filters:`, { sex, sport, level });
      let regionKeyForDataLookup = null;

      // Try to find by ID first
      const regionById = mockRegions.find(r => r.id === regionIdentifier);
      if (regionById) {
        regionKeyForDataLookup = regionById.id; // Use the ID for lookup
        DD(`Mock: Matched [${regionIdentifier}] as an ID. Using key [${regionKeyForDataLookup}].`);
      } else {
        // If not found by ID, try to find by name
        DD(`Mock: [${regionIdentifier}] not found as an ID. Trying as a name.`);
        const regionByName = mockRegions.find(r => r.name === regionIdentifier);
        if (regionByName) {
          regionKeyForDataLookup = regionByName.id; // Use the ID corresponding to the name for lookup
          DD(`Mock: Matched [${regionIdentifier}] as a name. Using key [${regionKeyForDataLookup}].`);
        }
      }

      if (regionKeyForDataLookup && mockRegionInfoData[regionKeyForDataLookup]) {
        const data = mockRegionInfoData[regionKeyForDataLookup];
        DD("Mock: Returning region info:", data);
        return Promise.resolve(data);
      } else {
        DD(`Mock: No data found for region/ID [${regionIdentifier}] (resolved key: [${regionKeyForDataLookup}]).`);
        return Promise.resolve({ clubs: [], stats: { count: 0, message: `No mock data for ${regionIdentifier}` }});
      }
    },
  };
};
