const test = require('node:test');
const assert = require('node:assert/strict');

const systemController = require('../../../../src/api/controllers/system');

function createMockRes() {
  return {
    data: null,
    json(data) {
      this.data = data;
    },
  };
}

test('system capabilities documents the safe fixture import workflow', () => {
  const controller = systemController({}, false);
  const res = createMockRes();

  controller.getCapabilities({}, res);

  assert.equal(res.data.contractVersion, '1.0.0');
  assert.equal(res.data.workflows.fixtureImport.api.validate.method, 'POST');
  assert.equal(
    res.data.workflows.fixtureImport.api.apply.path,
    '/api/tournaments/{tournamentId}/fixtures'
  );
  assert.ok(
    res.data.workflows.fixtureImport.guarantees.includes(
      'Invalid TSV is rejected before mutation.'
    )
  );
  assert.equal(
    res.data.workflows.fixtureMatchDay.api.rewind.path,
    '/api/tournaments/{tournamentId}/fixtures/rewind'
  );
  assert.equal(
    res.data.workflows.tournamentLifecycle.api.transition.path,
    '/api/tournaments/{tournamentId}/status'
  );
  assert.equal(
    res.data.workflows.squadManagement.api.players.path,
    '/api/tournaments/{tournamentId}/squads/{squadId}/players'
  );
  assert.equal(res.data.runtime.mode, 'database');
});

test('system capabilities warn when the API is in mock mode', () => {
  const controller = systemController({}, true);
  const res = createMockRes();

  controller.getCapabilities({}, res);

  assert.equal(res.data.runtime.mode, 'mock');
  assert.match(res.data.runtime.warning, /not persistent/);
});
