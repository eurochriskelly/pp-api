const { v4: uuidv4 } = require('uuid');
const { II } = require('../../../lib/logging');

// We need access to the events mock to expand events.
// In a real app, this separation is cleaner, but for mocks, we might duplicate or require the other mock.
// To avoid circular deps or complexity, I'll just keep a local reference or assume the events exist in the events mock service.
// However, since `require` caches, if I require the mock service factory, it returns a function.
// If the mock data is module-level variable in events.js, it's shared.
// Let's rely on the fact that for a mock, strict referential integrity isn't paramount,
// OR we can export the data array from events.js.
// For simplicity, I'll just mock the expanded events locally if needed or fetch them if I can.

let mockListings = [
  {
    id: 'lst_99',
    title: 'Youth Calendar',
    slug: 'youth-events',
    description: 'Events for U18s',
    createdBy: 'usr_55',
    eventIds: ['evt_123', 'evt_456'],
  },
];

module.exports = () => {
  II('Listings mock service initialized');

  return {
    getListing: async (idOrSlug, expandEvents = false) => {
      const listing = mockListings.find(
        (l) => l.id === idOrSlug || l.slug === idOrSlug
      );
      if (!listing) return null;

      const result = { ...listing };

      if (expandEvents) {
        // Simple expansion using the IDs (assuming they match our events mock data)
        // In a perfect world we'd link to the events mock.
        // For now, let's just create placeholder objects to verify the API contract works.
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

    listListings: async () => {
      return mockListings;
    },

    createListing: async (data) => {
      const id = `lst_${uuidv4().split('-')[0]}`;
      const newListing = {
        id,
        ...data,
        eventIds: data.eventIds || [],
      };
      mockListings.push(newListing);
      return newListing;
    },

    updateListing: async (id, data) => {
      const index = mockListings.findIndex((l) => l.id === id);
      if (index !== -1) {
        mockListings[index] = {
          ...mockListings[index],
          ...data,
        };
        return mockListings[index];
      }
      return null;
    },

    deleteListing: async (id) => {
      mockListings = mockListings.filter((l) => l.id !== id);
    },
  };
};
