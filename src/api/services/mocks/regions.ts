// Mock service for regions
import { II, DD } from '../../../lib/logging';

function splitRegion(rIn: string): {
  region: string;
  subregion: string | null;
} {
  const parts = rIn.split('%');
  return { region: parts[0], subregion: parts.length > 1 ? parts[1] : null };
}

export interface Region {
  id: string;
  name: string;
  activeClubsCount: number;
  activeTeamsCount: number;
}

export interface RegionInfoData {
  header: {
    activeClubsCount: number;
    activeTeamsCount: number;
    region: string;
    subregion: string | null;
    message?: string;
  };
  data: Array<{
    category: string;
    city: string;
    clubId: number;
    clubName: string;
    clubStatus: string;
    country: string;
    domain: string | null;
    post_code: string | null;
    region: string;
    subregion: string | null;
    teamId: number;
    teamName: string | null;
    teamStatus: string;
  }>;
}

export default function mockRegionsService() {
  II('Regions mock service initialized');

  const mockRegions: Region[] = [
    {
      id: 'paneuro',
      name: 'Pan-Euro',
      activeClubsCount: 10,
      activeTeamsCount: 25,
    },
    {
      id: 'benelux',
      name: 'Benelux',
      activeClubsCount: 8,
      activeTeamsCount: 15,
    },
    {
      id: 'northwest',
      name: 'North/West',
      activeClubsCount: 12,
      activeTeamsCount: 30,
    },
    {
      id: 'centraleast',
      name: 'Central/East',
      activeClubsCount: 5,
      activeTeamsCount: 10,
    },
    { id: 'iberia', name: 'Iberia', activeClubsCount: 7, activeTeamsCount: 20 },
  ];

  const mockRegionInfoData: { [key: string]: RegionInfoData } = {
    paneuro: {
      header: {
        activeClubsCount: 1,
        activeTeamsCount: 2,
        region: 'paneuro',
        subregion: null,
      },
      data: [
        {
          category: 'gaa',
          city: 'Paris',
          clubId: 101,
          clubName: 'Paris Gaels',
          clubStatus: 'A',
          country: 'FR',
          domain: null,
          post_code: null,
          region: 'paneuro',
          subregion: null,
          teamId: 201,
          teamName: null,
          teamStatus: 'active',
        },
        {
          category: 'lgfa',
          city: 'Paris',
          clubId: 101,
          clubName: 'Paris Gaels',
          clubStatus: 'A',
          country: 'FR',
          domain: null,
          post_code: null,
          region: 'paneuro',
          subregion: null,
          teamId: 202,
          teamName: null,
          teamStatus: 'active',
        },
      ],
    },
    benelux: {
      header: {
        activeClubsCount: 5,
        activeTeamsCount: 19,
        region: 'benelux',
        subregion: null,
      },
      data: [
        {
          category: 'hurling',
          city: 'Amsterdam',
          clubId: 301,
          clubName: 'Amsterdam GAC',
          clubStatus: 'A',
          country: 'NL',
          domain: null,
          post_code: null,
          region: 'benelux',
          subregion: null,
          teamId: 401,
          teamName: null,
          teamStatus: 'active',
        },
        {
          category: 'lgfa',
          city: 'Amsterdam',
          clubId: 301,
          clubName: 'Amsterdam GAC',
          clubStatus: 'A',
          country: 'NL',
          domain: null,
          post_code: null,
          region: 'benelux',
          subregion: null,
          teamId: 402,
          teamName: null,
          teamStatus: 'active',
        },
        {
          category: 'gaa',
          city: 'Amsterdam',
          clubId: 301,
          clubName: 'Amsterdam GAC',
          clubStatus: 'A',
          country: 'NL',
          domain: null,
          post_code: null,
          region: 'benelux',
          subregion: null,
          teamId: 403,
          teamName: null,
          teamStatus: 'active',
        },
      ],
    },
    northwest: {
      header: {
        activeClubsCount: 2,
        activeTeamsCount: 2,
        region: 'northwest',
        subregion: null,
      },
      data: [
        {
          category: 'gaa',
          city: 'Brest',
          clubId: 501,
          clubName: 'Brest GAA',
          clubStatus: 'A',
          country: 'FR',
          domain: null,
          post_code: null,
          region: 'northwest',
          subregion: null,
          teamId: 601,
          teamName: null,
          teamStatus: 'active',
        },
        {
          category: 'camogie',
          city: 'Rennes',
          clubId: 502,
          clubName: 'Rennes Ar Gwazi Gouez',
          clubStatus: 'A',
          country: 'FR',
          domain: null,
          post_code: null,
          region: 'northwest',
          subregion: null,
          teamId: 602,
          teamName: null,
          teamStatus: 'active',
        },
      ],
    },
    centraleast: {
      header: {
        activeClubsCount: 0,
        activeTeamsCount: 0,
        region: 'centraleast',
        subregion: null,
        message: 'No active clubs/teams in mock data for Central/East',
      },
      data: [],
    },
    iberia: {
      header: {
        activeClubsCount: 1,
        activeTeamsCount: 1,
        region: 'iberia',
        subregion: null,
      },
      data: [
        {
          category: 'hurling',
          city: 'Madrid',
          clubId: 701,
          clubName: 'Madrid Harps',
          clubStatus: 'A',
          country: 'ES',
          domain: null,
          post_code: null,
          region: 'iberia',
          subregion: null,
          teamId: 801,
          teamName: null,
          teamStatus: 'active',
        },
      ],
    },
  };

  return {
    listRegions: async (): Promise<Region[]> => {
      II('Mock: listRegions called');
      DD(`Mock: Returning regions: ${JSON.stringify(mockRegions)}`);
      return Promise.resolve(mockRegions);
    },

    listRegionInfo: async (
      regionString: string,
      filters: { sex?: string; sport?: string; level?: string }
    ): Promise<RegionInfoData> => {
      II(
        `Mock: listRegionInfo called for region [${regionString}] with filters: ${JSON.stringify(
          filters
        )}`
      );
      const { region: parsedRegion, subregion: parsedSubregion } =
        splitRegion(regionString);

      const defaultData: RegionInfoData = {
        header: {
          region: parsedRegion,
          subregion: parsedSubregion,
          activeClubsCount: 0,
          activeTeamsCount: 0,
          message: `No mock data for ${regionString}`,
        },
        data: [],
      };

      const regionData = mockRegionInfoData[regionString] || defaultData;

      DD(`Mock: Returning region info: ${JSON.stringify(regionData)}`);
      return Promise.resolve(regionData);
    },
  };
}

export type MockRegionsService = ReturnType<typeof mockRegionsService>;
