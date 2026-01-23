const { v4: uuidv4 } = require('uuid');
const { II } = require('../../../lib/logging');

let mockEvents = [
  {
    id: 'evt_123',
    title: 'Championship Final',
    description: 'Full details about the final match.',
    startDate: '2024-08-20T14:00:00Z',
    endDate: '2024-08-20T17:00:00Z',
    location: 'Croke Park',
    region: 'Leinster',
    imageUrl: 'https://placehold.co/600x400',
    organizerId: 'usr_55',
    sports: ['Hurling', 'Camogie'],
  },
  {
    id: 'evt_456',
    title: 'Local Derby',
    description: 'The big game.',
    startDate: '2024-07-15T18:30:00Z',
    endDate: '2024-07-15T20:00:00Z',
    location: 'Local Pitch',
    region: 'Munster',
    imageUrl: 'https://placehold.co/600x400',
    organizerId: 'usr_55',
    sports: ['Football'],
  },
];

module.exports = () => {
  II('Events mock service initialized');

  const getEvent = async (id) => {
    return mockEvents.find((e) => e.id === id) || null;
  };

  return {
    getEvent,

    listEvents: async (filters) => {
      let filtered = [...mockEvents];

      if (filters.startDate) {
        filtered = filtered.filter((e) => e.startDate >= filters.startDate);
      }
      if (filters.endDate) {
        filtered = filtered.filter((e) => e.endDate <= filters.endDate);
      }
      if (filters.organizerId) {
        filtered = filtered.filter(
          (e) => e.organizerId === filters.organizerId
        );
      }

      if (filters.limit) {
        filtered = filtered.slice(0, parseInt(filters.limit));
      }

      return filtered;
    },

    createEvent: async (data) => {
      const id = `evt_${uuidv4().split('-')[0]}`;
      const newEvent = {
        id,
        ...data,
        sports: data.sports || [],
      };
      mockEvents.push(newEvent);
      return newEvent;
    },

    updateEvent: async (id, data) => {
      const index = mockEvents.findIndex((e) => e.id === id);
      if (index !== -1) {
        mockEvents[index] = {
          ...mockEvents[index],
          ...data,
        };
      }
    },

    deleteEvent: async (id) => {
      mockEvents = mockEvents.filter((e) => e.id !== id);
    },
  };
};
