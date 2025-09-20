const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkIntegrity,
} = require('../../src/api/services/tournaments/integrity-check/index.js');

// Mock database select function
const createMockSelect = (fixtures) => {
  const allFixtures = Array.isArray(fixtures) ? fixtures : [fixtures];
  return async (query, params) => {
    if (query.startsWith('SELECT id, team1Id, team2Id, umpireTeamId')) {
      return allFixtures;
    }
    if (query.startsWith('SELECT id, team1Planned, team2Planned, goals1')) {
      const [matchId] = params;
      const found = allFixtures.find((f) => f.id === matchId);
      return found ? [found] : [];
    }
    return [];
  };
};

test('should return no warnings for valid data', async () => {
  const fixtures = [
    {
      id: 1,
      team1Planned: 'Team A',
      team2Planned: 'Team B',
      team1Id: 'Team A',
      team2Id: 'Team B',
    },
    {
      id: 101,
      team1Planned: 'Winner Team',
      team2Planned: 'Loser Team',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
    },
    {
      id: 102,
      team1Planned: '~match:101/p:1', // Should resolve to 'Winner Team'
      team2Planned: 'Some Other Team',
      team1Id: 'Winner Team',
      team2Id: 'Some Other Team',
    },
  ];
  const mockSelect = createMockSelect(fixtures);
  const result = await checkIntegrity(1, mockSelect);
  assert.deepEqual(result.data, []);
});

test('should warn if referenced match does not exist', async () => {
  const fixtures = [
    {
      id: 102,
      team1Planned: '~match:999/p:1', // Match 999 does not exist
      team2Planned: 'Some Team',
      team1Id: 'Anything',
      team2Id: 'Some Team',
    },
  ];
  const mockSelect = createMockSelect(fixtures);
  const result = await checkIntegrity(1, mockSelect);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.data[0], {
    warningId: 1,
    message:
      'Referenced match 999 not found for fixture 102 field team1Planned',
  });
});

test('should warn if teamId does not match the winning team (p:1)', async () => {
  const fixtures = [
    {
      id: 101,
      team1Planned: 'Winner Team',
      team2Planned: 'Loser Team',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
    },
    {
      id: 102,
      team1Planned: '~match:101/p:1',
      team2Planned: 'Some Team',
      team1Id: 'WRONG TEAM', // This is the mismatch
      team2Id: 'Some Team',
    },
  ];
  const mockSelect = createMockSelect(fixtures);
  const result = await checkIntegrity(1, mockSelect);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.data[0], {
    warningId: 1,
    message:
      "Fixture 102 has a team1Planned value of '~match:101/p:1' and a value of 'WRONG TEAM' but the winner (p1) of match 101 was 'Winner Team'",
  });
});

test('should warn if teamId does not match the losing team (p:2)', async () => {
  const fixtures = [
    {
      id: 101,
      team1Planned: 'Winner Team',
      team2Planned: 'Loser Team',
      goals1: 1,
      points1: 0,
      goals2: 0,
      points2: 0,
    },
    {
      id: 102,
      team1Planned: '~match:101/p:2',
      team2Planned: 'Some Team',
      team1Id: 'WRONG TEAM', // Mismatch, should be 'Loser Team'
      team2Id: 'Some Team',
    },
  ];
  const mockSelect = createMockSelect(fixtures);
  const result = await checkIntegrity(1, mockSelect);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.data[0], {
    warningId: 1,
    message:
      "Fixture 102 has a team1Planned value of '~match:101/p:2' and a value of 'WRONG TEAM' but the loser (p2) of match 101 was 'Loser Team'",
  });
});

test('should warn if referenced match was a draw', async () => {
  const fixtures = [
    {
      id: 101,
      team1Planned: 'Team A',
      team2Planned: 'Team B',
      goals1: 1,
      points1: 0,
      goals2: 1,
      points2: 0,
    }, // Draw
    {
      id: 102,
      team1Planned: '~match:101/p:1',
      team2Planned: 'Some Team',
      team1Id: 'Team A',
      team2Id: 'Some Team',
    },
  ];
  const mockSelect = createMockSelect(fixtures);
  const result = await checkIntegrity(1, mockSelect);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.data[0], {
    warningId: 1,
    message:
      'Referenced match 101 for fixture 102 is a draw or has no score, so winner/loser cannot be determined.',
  });
});
