const test = require('node:test');
const assert = require('node:assert/strict');
const seriesControllerFactory = require('../../../../src/api/controllers/series');

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

const mockNext = (err) => {
  throw err;
};

const controller = seriesControllerFactory({}, true);

test('listSeries returns list', async () => {
  const req = { query: {} };
  const res = createMockRes();

  await controller.listSeries(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length > 0);
});

test('getSeriesById returns row', async () => {
  const req = { params: { id: '1' } };
  const res = createMockRes();

  await controller.getSeriesById(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.id, 1);
});

test('getSeriesById returns 400 for invalid id', async () => {
  const req = { params: { id: 'x' } };
  const res = createMockRes();

  await controller.getSeriesById(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'Invalid series ID' });
});

test('createSeries returns 201', async () => {
  const req = {
    body: {
      name: 'Youth Football Series',
      sport: 'football',
    },
  };
  const res = createMockRes();

  await controller.createSeries(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.name, 'Youth Football Series');
});

test('createSeries validates name', async () => {
  const req = { body: { sport: 'football' } };
  const res = createMockRes();

  await controller.createSeries(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'name is required' });
});

test('listSeriesChampionships returns championships', async () => {
  const req = { params: { id: '1' } };
  const res = createMockRes();

  await controller.listSeriesChampionships(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.equal(res.data.data[0].seriesId, 1);
});
