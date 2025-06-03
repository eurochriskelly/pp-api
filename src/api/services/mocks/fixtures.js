// Mock service for fixtures
// Behaves like src/api/services/fixtures.js but returns mock data
// and does not interact with a database.

const { II, DD } = require('../../../lib/logging'); // Assuming logging might be useful

module.exports = (db) => { // db parameter is kept for consistency with the real service but not used by mocks
  II("Fixtures mock service initialized");

  // Mock data store (optional, can be expanded if needed)
  let mockFixtures = [
    { id: 1, tournamentId: 1, team1: 'Mock Team A', team2: 'Mock Team B', scheduledTime: '10:00', pitch: 'Mock Pitch 1', started: null, ended: null, goals1: 0, points1: 0, goals2: 0, points2: 0, outcome: null, category: 'mens', stage: 'group', groupNumber: 1, notes: '' },
    { id: 2, tournamentId: 1, team1: 'Mock Team C', team2: 'Mock Team D', scheduledTime: '11:00', pitch: 'Mock Pitch 1', started: null, ended: null, goals1: 0, points1: 0, goals2: 0, points2: 0, outcome: null, category: 'mens', stage: 'group', groupNumber: 1, notes: '' },
  ];
  let mockCards = [];
  let nextCardId = 1;

  return {
    updateCalculatedFixtures: async (tournamentId, fixtureId) => {
      II(`Mock: updateCalculatedFixtures called for tournament [${tournamentId}], fixture [${fixtureId}]`);
      const fixture = mockFixtures.find(f => f.id === fixtureId && f.tournamentId === tournamentId);
      if (fixture) {
        fixture.notes = "calculated mock update at " + new Date().toISOString();
        DD("Mock: Updated fixture:", fixture);
        return { ...fixture }; // Return a copy
      }
      DD(`Mock: Fixture not found for updateCalculatedFixtures: tId=${tournamentId}, fId=${fixtureId}`);
      return null;
    },

    getFixturesByPitch: async (tournamentId, pitch) => {
      II(`Mock: getFixturesByPitch called for tournament [${tournamentId}], pitch [${pitch}]`);
      const result = mockFixtures.filter(f => f.tournamentId === tournamentId && f.pitch === pitch);
      DD(`Mock: Found ${result.length} fixtures for pitch [${pitch}]`);
      return result;
    },

    getFixture: async (tournamentId, fixtureId) => {
      II(`Mock: getFixture called for tournament [${tournamentId}], fixture [${fixtureId}]`);
      const fixture = mockFixtures.find(f => f.id === fixtureId && f.tournamentId === tournamentId);
      DD(fixture ? "Mock: Found fixture:" : `Mock: Fixture not found: tId=${tournamentId}, fId=${fixtureId}`, fixture || {});
      return fixture ? { ...fixture } : null; // Return a copy
    },

    getNextFixtures: async (tournamentId) => {
      II(`Mock: getNextFixtures called for tournament [${tournamentId}]`);
      // Return a subset of fixtures, e.g., not started, ordered by scheduledTime
      const result = mockFixtures
        .filter(f => f.tournamentId === tournamentId && !f.started)
        .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
      DD(`Mock: Found ${result.length} next fixtures`);
      return result;
    },

    rewindLatestFixture: async (tournamentId) => {
      II(`Mock: rewindLatestFixture called for tournament [${tournamentId}]`);
      const latestStarted = mockFixtures
        .filter(f => f.tournamentId === tournamentId && f.started)
        .sort((a,b) => new Date(b.started) - new Date(a.started))[0];
      
      if (latestStarted) {
        DD("Mock: Rewinding fixture:", latestStarted);
        latestStarted.started = null;
        latestStarted.ended = null;
        latestStarted.goals1 = 0;
        latestStarted.points1 = 0;
        latestStarted.goals2 = 0;
        latestStarted.points2 = 0;
        latestStarted.outcome = null;
        return { id: latestStarted.id, category: latestStarted.category, stage: latestStarted.stage, message: "Mock rewind successful" };
      }
      DD("Mock: No fixture found to rewind");
      return null;
    },

    startFixture: async (fixtureId) => {
      II(`Mock: startFixture called for fixture [${fixtureId}]`);
      const fixture = mockFixtures.find(f => f.id === fixtureId);
      if (fixture) {
        fixture.started = new Date().toISOString();
        DD("Mock: Started fixture:", fixture);
        return { started: fixture.started };
      }
      DD(`Mock: Fixture not found for startFixture: fId=${fixtureId}`);
      return null;
    },

    endFixture: async (fixtureId) => {
      II(`Mock: endFixture called for fixture [${fixtureId}]`);
      const fixture = mockFixtures.find(f => f.id === fixtureId);
      if (fixture && fixture.started) {
        fixture.ended = new Date().toISOString();
        DD("Mock: Ended fixture:", fixture);
        return { ended: fixture.ended };
      }
      DD(`Mock: Fixture not found or not started for endFixture: fId=${fixtureId}`);
      return null;
    },

    reschedule: async (data) => {
      II(`Mock: reschedule called with data:`, data);
      // data = { operation, targetPitch, tournamentId, fixtureId, relativeFixtureId, placement }
      const fixture = mockFixtures.find(f => f.id === data.fixtureId && f.tournamentId === data.tournamentId);
      if (fixture) {
        fixture.pitch = data.targetPitch || fixture.pitch;
        fixture.scheduledTime = "Rescheduled Mock Time @ " + new Date().toLocaleTimeString(); // Simplified
        DD("Mock: Rescheduled fixture:", fixture);
        return { message: "Mock reschedule successful", fixtureId: fixture.id, newScheduled: fixture.scheduledTime, pitch: fixture.pitch };
      }
      DD(`Mock: Fixture not found for reschedule: tId=${data.tournamentId}, fId=${data.fixtureId}`);
      return { message: "Mock reschedule failed, fixture not found" };
    },

    updateScore: async (tournamentId, fixtureId, team1, team2, outcome) => {
      II(`Mock: updateScore called for tId [${tournamentId}], fId [${fixtureId}] with outcome [${outcome}]`);
      DD("Team1 score:", team1, "Team2 score:", team2);
      const fixture = mockFixtures.find(f => f.id === fixtureId && f.tournamentId === tournamentId);
      if (fixture) {
        fixture.goals1 = team1.goals;
        fixture.points1 = team1.points;
        fixture.goals2 = team2.goals;
        fixture.points2 = team2.points;
        fixture.outcome = outcome;
        if (!fixture.started) fixture.started = new Date().toISOString();
        if (!fixture.ended) fixture.ended = new Date().toISOString();
        DD("Mock: Updated score for fixture:", fixture);
        return { message: "Mock score updated successfully", updated: true };
      }
      DD(`Mock: Fixture not found for updateScore: tId=${tournamentId}, fId=${fixtureId}`);
      return { message: "Mock score update failed, fixture not found", updated: false };
    },

    cardPlayers: async (tournamentId, fixtureId, cardData) => {
      II(`Mock: cardPlayers called for tId [${tournamentId}], fId [${fixtureId}]`);
      DD("Card data:", cardData);
      const newCard = { 
        id: cardData.id || nextCardId++, // Use provided ID or generate new one
        fixtureId, 
        tournamentId, 
        ...cardData 
      };
      // If updating, remove old card first
      if (cardData.id) {
        mockCards = mockCards.filter(c => c.id !== cardData.id);
      }
      mockCards.push(newCard);
      DD("Mock: Card added/updated:", newCard);
      return { cardAdded: !cardData.id, cardUpdated: !!cardData.id, cardId: newCard.id };
    },

    getCardedPlayers: async (tournamentId) => {
      II(`Mock: getCardedPlayers called for tournament [${tournamentId}]`);
      const result = mockCards.filter(c => c.tournamentId === tournamentId);
      DD(`Mock: Found ${result.length} carded players`);
      return result;
    },

    deleteCard: async (tournamentId, fixtureId, cardId) => {
      II(`Mock: deleteCard called for tId [${tournamentId}], fId [${fixtureId}], cardId [${cardId}]`);
      const initialLength = mockCards.length;
      mockCards = mockCards.filter(c => !(c.id === cardId && c.fixtureId === fixtureId && c.tournamentId === tournamentId));
      const cardDeleted = mockCards.length < initialLength;
      DD(cardDeleted ? `Mock: Card ${cardId} deleted.` : `Mock: Card ${cardId} not found.`);
      return { cardDeleted };
    },
  };
};
