const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateNumericId,
  validateTournamentIdentifier,
  validateUUID,
} = require('../../../src/api/middleware/validation');

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  return res;
}

const mockNext = () => {
  // Success - no error
};

function createTournamentLookupDb(tournament) {
  return {
    query(sql, params, callback) {
      if (sql.includes('FROM tournaments') && sql.includes('eventUuid')) {
        callback(null, tournament ? [tournament] : []);
        return;
      }

      if (
        sql.includes('FROM pitches WHERE tournamentId = ?') ||
        sql.includes('sqlGroupStandings') ||
        sql.includes('FROM (')
      ) {
        callback(null, []);
        return;
      }

      callback(null, []);
    },
  };
}

test('validateNumericId: accepts valid numeric ID', () => {
  const req = { params: { tournamentId: '123' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateNumericId('tournamentId');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(req.validatedParams.tournamentId, 123);
});

test('validateNumericId: rejects comma-separated IDs with 400', () => {
  const req = { params: { tournamentId: '63,64,65' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateNumericId('tournamentId');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.data.error,
    'Invalid tournamentId: must be a positive integer'
  );
});

test('validateNumericId: rejects non-numeric string with 400', () => {
  const req = { params: { tournamentId: 'abc' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateNumericId('tournamentId');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.data.error,
    'Invalid tournamentId: must be a positive integer'
  );
});

test('validateNumericId: rejects zero with 400', () => {
  const req = { params: { tournamentId: '0' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateNumericId('tournamentId');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
});

test('validateNumericId: rejects negative number with 400', () => {
  const req = { params: { tournamentId: '-1' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateNumericId('tournamentId');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
});

test('validateNumericId: rejects missing parameter with 400', () => {
  const req = { params: {}, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateNumericId('tournamentId');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'Missing required parameter: tournamentId');
});

test('validateUUID: accepts valid UUID', () => {
  const req = {
    params: { uuid: '550e8400-e29b-41d4-a716-446655440000' },
    validatedParams: {},
  };
  const res = createMockRes();

  const middleware = validateUUID('uuid');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(
    req.validatedParams.uuid,
    '550e8400-e29b-41d4-a716-446655440000'
  );
});

test('validateUUID: rejects invalid UUID format with 400', () => {
  const req = { params: { uuid: 'not-a-uuid' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateUUID('uuid');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'Invalid uuid: must be a valid UUID');
});

test('validateUUID: rejects missing UUID parameter with 400', () => {
  const req = { params: {}, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateUUID('uuid');
  middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'Missing required parameter: uuid');
});

test('validateTournamentIdentifier: accepts numeric tournament ID', async () => {
  const req = { params: { tournamentId: '123' }, validatedParams: {} };
  const res = createMockRes();
  let nextCalled = false;

  const middleware = validateTournamentIdentifier(null, true);
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.equal(req.params.tournamentId, '123');
  assert.equal(req.validatedParams.tournamentId, 123);
});

test('validateTournamentIdentifier: resolves UUID to numeric tournament ID', async () => {
  const req = {
    params: { tournamentId: '550e8400-e29b-41d4-a716-446655440000' },
    validatedParams: {},
  };
  const res = createMockRes();
  let nextCalled = false;

  const middleware = validateTournamentIdentifier(
    createTournamentLookupDb({
      id: 42,
      Date: '2025-06-07',
      endDate: null,
      Title: 'Test Tournament',
      Location: 'Amsterdam',
      region: 'Benelux',
      season: '2025',
      eventUuid: '550e8400-e29b-41d4-a716-446655440000',
      status: 'started',
      code: 'ABCD',
      Lat: 0,
      Lon: 0,
    }),
    false
  );
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.equal(req.params.tournamentId, '42');
  assert.equal(req.validatedParams.tournamentId, 42);
  assert.equal(
    req.validatedParams.tournamentIdUuid,
    '550e8400-e29b-41d4-a716-446655440000'
  );
});

test('validateTournamentIdentifier: rejects unknown UUID with 404', async () => {
  const req = {
    params: { tournamentId: '550e8400-e29b-41d4-a716-446655440099' },
    validatedParams: {},
  };
  const res = createMockRes();

  const middleware = validateTournamentIdentifier(
    createTournamentLookupDb(null),
    false
  );
  await middleware(req, res, mockNext);

  assert.equal(res.statusCode, 404);
  assert.equal(res.data.error, 'TOURNAMENT_NOT_FOUND');
});

test('validateTournamentIdentifier: rejects invalid identifier with 400', async () => {
  const req = { params: { tournamentId: 'abc' }, validatedParams: {} };
  const res = createMockRes();

  const middleware = validateTournamentIdentifier(null, true);
  await middleware(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.data.error,
    'Invalid tournamentId: must be a positive integer or UUID'
  );
});
