const test = require('node:test');
const assert = require('node:assert/strict');
const listingsControllerFactory = require('../../../../src/api/controllers/listings');

test('getListingIcal generates valid iCal content', async (t) => {
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

test('getListingIcal returns 404 for missing listing', async (t) => {
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
