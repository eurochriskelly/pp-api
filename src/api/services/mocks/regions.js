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
        { team_id: 1, team_name: "Mock Team Pan-Euro Alpha", club_status: 'active', team_status: 'active', category: 'gaa', region: 'paneuro', subregion: null },
        { team_id: 2, team_name: "Mock Team Pan-Euro Beta", club_status: 'active', team_status: 'active', category: 'lgfa', region: 'paneuro', subregion: null }
      ]
    },
    "benelux": {
      header: { activeClubsCount: 1, activeTeamsCount: 1, region: "benelux", subregion: null },
      data: [
        { team_id: 3, team_name: "Mock Team Benelux Charlie", club_status: 'active', team_status: 'active', category: 'hurling', region: 'benelux', subregion: null }
      ]
    },
    "northwest": {
      header: { activeClubsCount: 2, activeTeamsCount: 3, region: "northwest", subregion: null },
      data: [
        { team_id: 4, team_name: "Mock Team NW Delta", club_status: 'active', team_status: 'active', category: 'gaa', region: 'northwest', subregion: null },
        { team_id: 5, team_name: "Mock Team NW Echo", club_status: 'active', team_status: 'active', category: 'camogie', region: 'northwest', subregion: null },
        { team_id: 6, team_name: "Mock Team NW Foxtrot", club_status: 'active', team_status: 'inactive', category: 'gaa', region: 'northwest', subregion: null } // Example inactive team
      ]
    },
    "centraleast": {
      header: { activeClubsCount: 0, activeTeamsCount: 0, region: "centraleast", subregion: null, message: "No active clubs/teams in mock data for Central/East" },
      data: []
    },
    "iberia": {
      header: { activeClubsCount: 1, activeTeamsCount: 1, region: "iberia", subregion: null },
      data: [
        { team_id: 7, team_name: "Mock Team Iberia Golf", club_status: 'active', team_status: 'active', category: 'hurling', region: 'iberia', subregion: null }
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
