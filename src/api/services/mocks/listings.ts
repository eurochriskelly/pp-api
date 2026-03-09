import { v4 as uuidv4 } from 'uuid';
import { II } from '../../../lib/logging';

export interface Listing {
  id: string;
  title: string;
  slug: string;
  description: string;
  createdBy: string;
  eventIds: string[];
  heroConfig?: any;
}

export interface ExpandedEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  sports: string[];
}

let mockListings: Listing[] = [
  {
    id: 'lst_99',
    title: 'Youth Calendar',
    slug: 'youth-events',
    description: 'Events for U18s',
    createdBy: 'usr_55',
    eventIds: ['evt_123', 'evt_456'],
  },
];

export default function mockListingsService() {
  II('Listings mock service initialized');

  return {
    getListing: async (
      idOrSlug: string,
      expandEvents = false
    ): Promise<(Listing & { events?: ExpandedEvent[] }) | null> => {
      const listing = mockListings.find(
        (l) => l.id === idOrSlug || l.slug === idOrSlug
      );
      if (!listing) return null;

      const result: Listing & { events?: ExpandedEvent[] } = { ...listing };

      if (expandEvents) {
        result.events = result.eventIds.map((eid) => ({
          id: eid,
          title: 'Mock Expanded Event',
          description: 'This comes from the listings mock expansion',
          startDate: '2024-01-01T12:00:00Z',
          endDate: '2024-01-01T14:00:00Z',
          sports: ['MockSport'],
        }));
      }

      return result;
    },

    listListings: async (): Promise<Listing[]> => {
      return mockListings;
    },

    createListing: async (data: any): Promise<Listing> => {
      const id = `lst_${uuidv4().split('-')[0]}`;
      const { hero_config, ...rest } = data;
      const newListing: Listing = {
        id,
        ...rest,
        heroConfig: hero_config,
        eventIds: data.eventIds || [],
      };
      mockListings.push(newListing);
      return newListing;
    },

    updateListing: async (id: string, data: any): Promise<Listing | null> => {
      const index = mockListings.findIndex((l) => l.id === id);
      if (index !== -1) {
        const { hero_config, ...rest } = data;
        mockListings[index] = {
          ...mockListings[index],
          ...rest,
        };
        if (hero_config !== undefined) {
          mockListings[index].heroConfig = hero_config;
        }
        return mockListings[index];
      }
      return null;
    },

    deleteListing: async (id: string): Promise<void> => {
      mockListings = mockListings.filter((l) => l.id !== id);
    },
  };
}

export type MockListingsService = ReturnType<typeof mockListingsService>;
