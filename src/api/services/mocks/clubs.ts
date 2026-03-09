// Mock service for clubs
import { II } from '../../../lib/logging';

export interface Club {
  clubId: number;
  clubName: string;
}

export interface ClubDetails {
  clubId: number;
  clubCode: string | null;
  isStudent: string;
  clubName: string;
  founded: number | null;
  affiliated: number | null;
  deactivated: string | null;
  street_address: string | null;
  post_code: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  subregion: string | null;
  status: string;
  domain: string | null;
  clubLogo?: Buffer;
}

const mockClubs: Club[] = [
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

const mockClubDetails: ClubDetails[] = [
  {
    clubId: 1,
    clubCode: 'AMFC',
    isStudent: 'no',
    clubName: 'Amherst FC',
    founded: 2010,
    affiliated: 2011,
    deactivated: null,
    street_address: '123 Main St',
    post_code: '12345',
    country: 'US',
    city: 'Amherst',
    latitude: 42.3868,
    longitude: -72.5301,
    region: 'Northeast',
    subregion: 'New England',
    status: 'active',
    domain: 'amherstfc.com',
  },
];

let nextClubId = 11;

export default function mockClubsService() {
  II('Clubs mock service initialized');
  return {
    listClubs: async (search?: string, limit = 10) => {
      let filtered = mockClubs;
      if (search && search.length >= 2) {
        filtered = filtered.filter((club) =>
          club.clubName.toLowerCase().includes(search.toLowerCase())
        );
      }
      return filtered.slice(0, limit);
    },

    getClubById: async (id: number) => {
      const club = mockClubDetails.find((c) => c.clubId === id);
      if (club) return club;

      const basicClub = mockClubs.find((c) => c.clubId === id);
      if (basicClub) {
        return {
          clubId: basicClub.clubId,
          clubCode: null,
          isStudent: 'no',
          clubName: basicClub.clubName,
          founded: null,
          affiliated: null,
          deactivated: null,
          street_address: null,
          post_code: null,
          country: null,
          city: null,
          latitude: null,
          longitude: null,
          region: null,
          subregion: null,
          status: 'active',
          domain: null,
        } as ClubDetails;
      }
      return null;
    },

    createClub: async (clubData: Partial<ClubDetails>) => {
      const clubId = nextClubId++;
      const newClub: ClubDetails = {
        clubId,
        clubCode: clubData.clubCode || null,
        isStudent: clubData.isStudent || 'no',
        clubName: clubData.clubName!,
        founded: clubData.founded || null,
        affiliated: clubData.affiliated || null,
        deactivated: clubData.deactivated || null,
        street_address: clubData.street_address || null,
        post_code: clubData.post_code || null,
        country: clubData.country || null,
        city: clubData.city || null,
        latitude: clubData.latitude || null,
        longitude: clubData.longitude || null,
        region: clubData.region || null,
        subregion: clubData.subregion || null,
        status: clubData.status || 'active',
        domain: clubData.domain || null,
      };
      mockClubDetails.push(newClub);
      mockClubs.push({ clubId, clubName: newClub.clubName });
      return newClub;
    },

    updateClub: async (id: number, clubData: Partial<ClubDetails>) => {
      const index = mockClubDetails.findIndex((c) => c.clubId === id);
      if (index === -1) {
        throw new Error('Club not found');
      }

      const allowedFields = [
        'clubCode',
        'isStudent',
        'clubName',
        'founded',
        'affiliated',
        'deactivated',
        'street_address',
        'post_code',
        'country',
        'city',
        'latitude',
        'longitude',
        'region',
        'subregion',
        'status',
        'domain',
      ];

      allowedFields.forEach((field) => {
        if ((clubData as any)[field] !== undefined) {
          (mockClubDetails[index] as any)[field] = (clubData as any)[field];
        }
      });

      if (clubData.clubName) {
        const basicIndex = mockClubs.findIndex((c) => c.clubId === id);
        if (basicIndex !== -1) {
          mockClubs[basicIndex].clubName = clubData.clubName;
        }
      }

      return { clubId: id, ...clubData };
    },

    deleteClub: async (id: number) => {
      const index = mockClubDetails.findIndex((c) => c.clubId === id);
      if (index === -1) {
        throw new Error('Club not found');
      }
      mockClubDetails[index].status = 'inactive';
      return { clubId: id, message: 'Club deactivated' };
    },

    uploadLogo: async (id: number, logoBuffer: Buffer) => {
      const index = mockClubDetails.findIndex((c) => c.clubId === id);
      if (index === -1) {
        throw new Error('Club not found');
      }
      mockClubDetails[index].clubLogo = logoBuffer;
      return { clubId: id, message: 'Logo uploaded successfully' };
    },

    getLogo: async (id: number) => {
      const club = mockClubDetails.find((c) => c.clubId === id);
      if (!club) {
        return null;
      }
      return club.clubLogo || null;
    },
  };
}

export type MockClubsService = ReturnType<typeof mockClubsService>;
