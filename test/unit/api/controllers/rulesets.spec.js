const test = require('node:test');
const assert = require('node:assert/strict');
const controllerFactory = require('../../../../src/api/controllers/rulesets');

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

const controller = controllerFactory({}, true);

test('listRulesets returns rows', async () => {
  const req = {};
  const res = createMockRes();

  await controller.listRulesets(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data.data));
  assert.ok(res.data.data.length > 0);
});

test('getRulesetById returns row', async () => {
  const req = { params: { rulesetId: '1' } };
  const res = createMockRes();

  await controller.getRulesetById(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.id, 1);
});

test('createRuleset validates required fields', async () => {
  const req = { body: { name: 'Missing config' } };
  const res = createMockRes();

  await controller.createRuleset(req, res, mockNext);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.data, { error: 'name and config are required' });
});

test('createRuleset creates row', async () => {
  const req = {
    body: {
      name: 'Custom 2026 Rules',
      configVersion: '1.0',
      config: { points: { win: 3, draw: 1, loss: 0 } },
    },
  };
  const res = createMockRes();

  await controller.createRuleset(req, res, mockNext);

  assert.equal(res.statusCode, 201);
  assert.equal(res.data.data.name, 'Custom 2026 Rules');
});

test('updateRuleset updates row', async () => {
  const req = {
    params: { rulesetId: '1' },
    body: { description: 'Updated description' },
  };
  const res = createMockRes();

  await controller.updateRuleset(req, res, mockNext);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.data.description, 'Updated description');
});
