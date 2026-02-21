const test = require('node:test');
const assert = require('node:assert/strict');
const clubsControllerFactory = require('../../../../src/api/controllers/clubs');

// Mock request/response helpers
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
    send(data) {
      this.data = data;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
  };
  return res;
}

const mockNext = (err) => {
  throw err;
};

// Initialize controller with useMock=true (shared)
const controller = clubsControllerFactory({}, true);

test('listClubs returns list of clubs', async () => {
  const req = { query: {} };
  const res = createMockRes();

  await controller.listClubs(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length > 0);
  assert.ok(res.data.data[0].clubId);
  assert.ok(res.data.data[0].clubName);
});

test('listClubs filters by search query', async () => {
  const req = { query: { search: 'Amherst' } };
  const res = createMockRes();

  await controller.listClubs(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  if (res.data.data.length > 0) {
    assert.ok(res.data.data[0].clubName.toLowerCase().includes('amherst'));
  }
});

test('getClubById returns club details', async () => {
  const req = { params: { id: '1' } };
  const res = createMockRes();

  await controller.getClubById(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(res.data.data.clubId);
  assert.ok(res.data.data.clubName);
});

test('getClubById returns 404 for non-existent club', async () => {
  const req = { params: { id: '99999' } };
  const res = createMockRes();

  await controller.getClubById(req, res, mockNext);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.data, { error: 'Club not found' });
});

test('getClubById returns 400 for invalid ID', async () => {
  const req = { params: { id: 'invalid' } };
  const res = createMockRes();

  await controller.getClubById(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid club ID' });
});

test('createClub creates new club', async () => {
  const req = {
    body: {
      clubName: 'Test Club',
      clubCode: 'TEST',
      country: 'US',
      city: 'Test City',
    },
  };
  const res = createMockRes();

  await controller.createClub(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.ok(res.data.data.clubId);
  assert.equal(res.data.data.clubName, 'Test Club');
  assert.equal(res.data.data.clubCode, 'TEST');
  assert.equal(res.data.data.country, 'US');
});

test('createClub returns 400 when clubName is missing', async () => {
  const req = { body: { clubCode: 'TEST' } };
  const res = createMockRes();

  await controller.createClub(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'clubName is required' });
});

test('updateClub updates club details', async () => {
  // First create a club
  const createReq = {
    body: {
      clubName: 'Club To Update',
      country: 'US',
    },
  };
  const createRes = createMockRes();
  await controller.createClub(createReq, createRes, mockNext);
  const clubId = createRes.data.data.clubId;

  // Update it
  const req = {
    params: { id: String(clubId) },
    body: { city: 'New City', clubCode: 'NEW' },
  };
  const res = createMockRes();

  await controller.updateClub(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.clubId, clubId);
  assert.equal(res.data.data.city, 'New City');
  assert.equal(res.data.data.clubCode, 'NEW');
});

test('updateClub returns 400 for invalid ID', async () => {
  const req = {
    params: { id: 'invalid' },
    body: { city: 'New City' },
  };
  const res = createMockRes();

  await controller.updateClub(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid club ID' });
});

test('deleteClub deactivates club', async () => {
  // First create a club
  const createReq = {
    body: {
      clubName: 'Club To Delete',
      country: 'US',
    },
  };
  const createRes = createMockRes();
  await controller.createClub(createReq, createRes, mockNext);
  const clubId = createRes.data.data.clubId;

  // Delete it
  const req = { params: { id: String(clubId) } };
  const res = createMockRes();

  await controller.deleteClub(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.clubId, clubId);
  assert.equal(res.data.data.message, 'Club deactivated');
});

test('deleteClub returns 400 for invalid ID', async () => {
  const req = { params: { id: 'invalid' } };
  const res = createMockRes();

  await controller.deleteClub(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid club ID' });
});

test('uploadLogo uploads logo blob', async () => {
  // First create a club
  const createReq = {
    body: {
      clubName: 'Club With Logo',
      country: 'US',
    },
  };
  const createRes = createMockRes();
  await controller.createClub(createReq, createRes, mockNext);
  const clubId = createRes.data.data.clubId;

  // Upload logo
  const logoBuffer = Buffer.from('fake-image-data');
  const req = {
    params: { id: String(clubId) },
    body: logoBuffer,
  };
  const res = createMockRes();

  await controller.uploadLogo(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.clubId, clubId);
  assert.equal(res.data.data.message, 'Logo uploaded successfully');
});

test('uploadLogo returns 400 when logo data is missing', async () => {
  const req = {
    params: { id: '1' },
    body: null,
  };
  const res = createMockRes();

  await controller.uploadLogo(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Logo data is required' });
});

test('uploadLogo returns 400 for invalid ID', async () => {
  const req = {
    params: { id: 'invalid' },
    body: Buffer.from('fake-image-data'),
  };
  const res = createMockRes();

  await controller.uploadLogo(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid club ID' });
});

test('getLogo returns logo image', async () => {
  // First create a club and upload a logo
  const createReq = {
    body: {
      clubName: 'Club With Logo Get',
      country: 'US',
    },
  };
  const createRes = createMockRes();
  await controller.createClub(createReq, createRes, mockNext);
  const clubId = createRes.data.data.clubId;

  // Upload logo
  const logoBuffer = Buffer.from('fake-image-data');
  const uploadReq = {
    params: { id: String(clubId) },
    body: logoBuffer,
  };
  const uploadRes = createMockRes();
  await controller.uploadLogo(uploadReq, uploadRes, mockNext);

  // Get logo
  const req = { params: { id: String(clubId) } };
  const res = createMockRes();

  await controller.getLogo(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.ok(Buffer.isBuffer(res.data));
});

test('getLogo returns 404 when logo not found', async () => {
  // Create a club without logo
  const createReq = {
    body: {
      clubName: 'Club Without Logo',
      country: 'US',
    },
  };
  const createRes = createMockRes();
  await controller.createClub(createReq, createRes, mockNext);
  const clubId = createRes.data.data.clubId;

  // Try to get logo
  const req = { params: { id: String(clubId) } };
  const res = createMockRes();

  await controller.getLogo(req, res, mockNext);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.data, { error: 'Logo not found' });
});

test('getLogo returns 400 for invalid ID', async () => {
  const req = { params: { id: 'invalid' } };
  const res = createMockRes();

  await controller.getLogo(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid club ID' });
});
