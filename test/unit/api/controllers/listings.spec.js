const test = require('node:test');
const assert = require('node:assert/strict');
const listingsControllerFactory = require('../../../../src/api/controllers/listings');

test('getListingIcal generates valid iCal content', async () => {
  const req = {
    params: { id: 'lst_99' },
  };

  let headers = {};
  let sentData = null;
  let status = 200;

  const res = {
    set: (key, value) => {
      headers[key] = value;
    },
    status: (s) => {
      status = s;
      return res;
    },
    json: (d) => {
      sentData = d;
      return res;
    },
    send: (d) => {
      sentData = d;
      return res;
    },
  };

  const next = (err) => {
    throw err;
  };

  // Initialize controller with useMock=true
  const controller = listingsControllerFactory({}, true);

  await controller.getListingIcal(req, res, next);

  assert.equal(status, 200);
  assert.equal(headers['Content-Type'], 'text/calendar');
  assert.match(
    headers['Content-Disposition'],
    /attachment; filename=".*\.ics"/
  );

  assert.ok(sentData.includes('BEGIN:VCALENDAR'));
  assert.ok(sentData.includes('VERSION:2.0'));
  assert.ok(sentData.includes('BEGIN:VEVENT'));
  assert.ok(sentData.includes('UID:evt_123@pp-api'));
  assert.ok(sentData.includes('SUMMARY:Mock Expanded Event'));
  // Check date format: 20240101T120000Z
  assert.ok(sentData.includes('DTSTART:20240101T120000Z'));
  assert.ok(sentData.includes('DTEND:20240101T140000Z'));
  assert.ok(sentData.includes('END:VEVENT'));
  assert.ok(sentData.includes('END:VCALENDAR'));
});

test('getListingIcal returns 404 for missing listing', async () => {
  const req = {
    params: { id: 'non_existent_listing' },
  };

  let sentData = null;
  let status = 200;

  const res = {
    set: () => {},
    status: (s) => {
      status = s;
      return res;
    },
    json: (d) => {
      sentData = d;
      return res;
    },
    send: (d) => {
      sentData = d;
      return res;
    },
  };

  const next = (err) => {
    throw err;
  };

  const controller = listingsControllerFactory({}, true);

  await controller.getListingIcal(req, res, next);

  assert.equal(status, 404);
  assert.deepEqual(sentData, { error: 'Listing not found' });
});

// Mock request/response helpers for hero tests
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
    },
  };
  return res;
}

const mockNext = (err) => {
  throw err;
};

// Initialize controller with useMock=true (shared)
const controller = listingsControllerFactory({}, true);

test('createListing accepts hero_config and returns heroConfig', async (t) => {
  const heroConfig = {
    headline: 'Test Headline',
    primaryColor: '#000000',
  };

  const req = {
    body: {
      title: 'Hero Listing',
      slug: 'hero-listing',
      hero_config: heroConfig,
    },
    user: { id: 'usr_test' },
  };
  const res = createMockRes();

  await controller.createListing(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.ok(res.data.data.id);
  assert.deepEqual(res.data.data.heroConfig, heroConfig);

  // Store ID for next tests
  t.diagnostic(`Created listing ID: ${res.data.data.id}`);
});

test('getListing returns heroConfig', async () => {
  // First create one
  const heroConfig = {
    headline: 'Get Test',
    style: 'image',
  };

  const createReq = {
    body: { title: 'Get Test', slug: 'get-test', hero_config: heroConfig },
    user: { id: 'usr_test' },
  };
  const createRes = createMockRes();
  await controller.createListing(createReq, createRes, mockNext);
  const id = createRes.data.data.id;

  // Now get it
  const req = { params: { id } };
  const res = createMockRes();

  // Mock query for expand
  req.query = {};

  await controller.getListing(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data.data.heroConfig, heroConfig);
});

test('updateListing updates hero_config', async () => {
  // First create one
  const createReq = {
    body: { title: 'Update Test', slug: 'update-test' },
    user: { id: 'usr_test' },
  };
  const createRes = createMockRes();
  await controller.createListing(createReq, createRes, mockNext);
  const id = createRes.data.data.id;

  // Update it
  const newHeroConfig = {
    headline: 'Updated Headline',
    overlayOpacity: 80,
  };

  const req = {
    params: { id },
    body: {
      hero_config: newHeroConfig,
    },
  };
  const res = createMockRes();

  await controller.updateListing(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data.data.heroConfig, newHeroConfig);

  // Verify with GET
  const getReq = { params: { id }, query: {} };
  const getRes = createMockRes();
  await controller.getListing(getReq, getRes, mockNext);
  assert.deepEqual(getRes.data.data.heroConfig, newHeroConfig);
});
