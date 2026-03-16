const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateNumericId,
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
