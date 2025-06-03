// Mock service for regions
const { II, DD } = require('../../../lib/logging');

// Utility function similar to the one in the real service
function splitRegion(rIn) {
  const parts = rIn.split('%');
  return { region: parts[0], subregion: parts.length > 1 ? parts[1] : null };
}

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("Regions mock service initialized");

  const mockRegions = [
    { id: 'paneuro', name: 'Pan-Euro', activeClubsCount: 10, activeTeamsCount: 25 },
    { id: 'benelux', name: 'Benelux', activeClubsCount: 8, activeTeamsCount: 15 },
    { id: 'northwest', name: 'North/West', activeClubsCount: 12, activeTeamsCount: 30 },
    { id: 'centraleast', name: 'Central/East', activeClubsCount: 5, activeTeamsCount: 10 },
    { id: 'iberia', name: 'Iberia', activeClubsCount: 7, activeTeamsCount: 20 }
  ];

  const mockRegionInfoData = {
    "paneuro": {
      header: { activeClubsCount: 1, activeTeamsCount: 2, region: "paneuro", subregion: null },
      data: [
        { category: "gaa", city: "Paris", clubId: 101, clubName: "Paris Gaels", clubStatus: "A", country: "FR", domain: null, post_code: null, region: "paneuro", subregion: null, teamId: 201, teamName: null, teamStatus: "active" },
        { category: "lgfa", city: "Paris", clubId: 101, clubName: "Paris Gaels", clubStatus: "A", country: "FR", domain: null, post_code: null, region: "paneuro", subregion: null, teamId: 202, teamName: null, teamStatus: "active" }
      ]
    },
    "benelux": {
      header: { activeClubsCount: 5, activeTeamsCount: 19, region: "benelux", subregion: null },
      data: [
        // Club 1 (Amsterdam) - 3 teams
        { category: "hurling", city: "Amsterdam", clubId: 301, clubName: "Amsterdam GAC", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 401, teamName: null, teamStatus: "active" },
        { category: "lgfa", city: "Amsterdam", clubId: 301, clubName: "Amsterdam GAC", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 402, teamName: null, teamStatus: "active" },
        { category: "gaa", city: "Amsterdam", clubId: 301, clubName: "Amsterdam GAC", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 403, teamName: null, teamStatus: "active" },
        // Club 2 (Brussels) - 4 teams
        { category: "camogie", city: "Brussels", clubId: 302, clubName: "Belgium GAA", clubStatus: "A", country: "BE", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 404, teamName: null, teamStatus: "active" },
        { category: "gaa", city: "Brussels", clubId: 302, clubName: "Belgium GAA", clubStatus: "A", country: "BE", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 405, teamName: null, teamStatus: "active" },
        { category: "lgfa", city: "Brussels", clubId: 302, clubName: "Belgium GAA", clubStatus: "A", country: "BE", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 406, teamName: null, teamStatus: "active" },
        { category: "hurling", city: "Brussels", clubId: 302, clubName: "Belgium GAA", clubStatus: "A", country: "BE", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 407, teamName: null, teamStatus: "active" },
        // Club 3 (Luxembourg) - 5 teams
        { category: "youthfootball", city: "Luxembourg", clubId: 303, clubName: "Luxembourg Irish Club", clubStatus: "A", country: "LU", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 408, teamName: null, teamStatus: "active" },
        { category: "gaa", city: "Luxembourg", clubId: 303, clubName: "Luxembourg Irish Club", clubStatus: "A", country: "LU", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 409, teamName: null, teamStatus: "active" },
        { category: "lgfa", city: "Luxembourg", clubId: 303, clubName: "Luxembourg Irish Club", clubStatus: "A", country: "LU", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 410, teamName: null, teamStatus: "active" },
        { category: "hurling", city: "Luxembourg", clubId: 303, clubName: "Luxembourg Irish Club", clubStatus: "A", country: "LU", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 411, teamName: null, teamStatus: "active" },
        { category: "camogie", city: "Luxembourg", clubId: 303, clubName: "Luxembourg Irish Club", clubStatus: "A", country: "LU", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 412, teamName: null, teamStatus: "active" },
        // Club 4 (The Hague) - 3 teams
        { category: "gaa", city: "The Hague", clubId: 304, clubName: "Den Haag GFC", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 413, teamName: null, teamStatus: "active" },
        { category: "lgfa", city: "The Hague", clubId: 304, clubName: "Den Haag GFC", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 414, teamName: null, teamStatus: "active" },
        { category: "youthhurling", city: "The Hague", clubId: 304, clubName: "Den Haag GFC", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 415, teamName: null, teamStatus: "active" },
        // Club 5 (Eindhoven) - 4 teams
        { category: "hurling", city: "Eindhoven", clubId: 305, clubName: "Eindhoven Shamrocks", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 416, teamName: null, teamStatus: "active" },
        { category: "camogie", city: "Eindhoven", clubId: 305, clubName: "Eindhoven Shamrocks", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 417, teamName: null, teamStatus: "active" },
        { category: "gaa", city: "Eindhoven", clubId: 305, clubName: "Eindhoven Shamrocks", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 418, teamName: null, teamStatus: "active" },
        { category: "lgfa", city: "Eindhoven", clubId: 305, clubName: "Eindhoven Shamrocks", clubStatus: "A", country: "NL", domain: null, post_code: null, region: "benelux", subregion: null, teamId: 419, teamName: null, teamStatus: "active" },
      ]
    },
    "northwest": {
      header: { activeClubsCount: 2, activeTeamsCount: 2, region: "northwest", subregion: null }, // activeTeamsCount is 2 because one team is inactive
      data: [
        { category: "gaa", city: "Brest", clubId: 501, clubName: "Brest GAA", clubStatus: "A", country: "FR", domain: null, post_code: null, region: "northwest", subregion: null, teamId: 601, teamName: null, teamStatus: "active" },
        { category: "camogie", city: "Rennes", clubId: 502, clubName: "Rennes Ar Gwazi Gouez", clubStatus: "A", country: "FR", domain: null, post_code: null, region: "northwest", subregion: null, teamId: 602, teamName: null, teamStatus: "active" },
        { category: "gaa", city: "Rennes", clubId: 502, clubName: "Rennes Ar Gwazi Gouez", clubStatus: "A", country: "FR", domain: null, post_code: null, region: "northwest", subregion: null, teamId: 603, teamName: null, teamStatus: "inactive" } // Example inactive team
      ]
    },
    "centraleast": {
      header: { activeClubsCount: 0, activeTeamsCount: 0, region: "centraleast", subregion: null, message: "No active clubs/teams in mock data for Central/East" },
      data: []
    },
    "iberia": {
      header: { activeClubsCount: 1, activeTeamsCount: 1, region: "iberia", subregion: null },
      data: [
        { category: "hurling", city: "Madrid", clubId: 701, clubName: "Madrid Harps", clubStatus: "A", country: "ES", domain: null, post_code: null, region: "iberia", subregion: null, teamId: 801, teamName: null, teamStatus: "active" }
      ]
    }
  };

  return {
    listRegions: async () => {
      II("Mock: listRegions called");
      DD("Mock: Returning regions:", mockRegions);
      return Promise.resolve(mockRegions);
    },

    listRegionInfo: async (regionString, { sex, sport, level }) => {
      II(`Mock: listRegionInfo called for region [${regionString}] with filters:`, { sex, sport, level });
      const { region: parsedRegion, subregion: parsedSubregion } = splitRegion(regionString);
      
      // Filters (sex, sport, level) are mostly ignored in this basic mock for simplicity.
      // A more complex mock could filter the 'data' array based on these.
      // For now, we just return the pre-defined data for the region key.
      // The activeTeamsCount in the header should ideally reflect filtered results.
      // Here, we'll just use the stored header count.

      const defaultData = { 
        header: { 
          region: parsedRegion, 
          subregion: parsedSubregion, 
          activeClubsCount: 0, 
          activeTeamsCount: 0, 
          message: `No mock data for ${regionString}` 
        },
        data: [] 
      };
      
      const regionData = mockRegionInfoData[regionString] || defaultData;
      
      // If filters are applied, a real mock would filter regionData.data and update regionData.header.activeTeamsCount
      // For example, if filtering for 'active' teams:
      // let filteredTeams = regionData.data.filter(team => team.team_status === 'active');
      // if (sex) { /* apply sex filter */ } ... etc.
      // regionData.data = filteredTeams;
      // regionData.header.activeTeamsCount = filteredTeams.length;
      // This mock keeps it simple and returns all teams for the region, relying on header counts.

      DD("Mock: Returning region info:", regionData);
      return Promise.resolve(regionData);
    },
  };
};
