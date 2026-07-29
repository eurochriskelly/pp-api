const test = require('node:test');
const assert = require('node:assert/strict');
const controllerFactory = require('../../../../src/api/controllers/tournament-reports');
const serviceFactory = require('../../../../src/api/services/mocks/tournament-reports');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
}

const next = (err) => {
  if (err) throw err;
};

const adminReq = (overrides = {}) => ({
  user: { id: '1', role: 'admin' },
  validatedParams: { tournamentId: 1, tournamentIdUuid: 'evt-uuid-1' },
  params: {},
  query: {},
  body: {},
  ...overrides,
});

const publicReq = (overrides = {}) => ({
  validatedParams: { tournamentId: 1, tournamentIdUuid: 'evt-uuid-1' },
  params: {},
  query: {},
  body: {},
  ...overrides,
});

test.beforeEach(() => {
  const svc = serviceFactory();
  svc.__reset();
});

test('listReports returns empty list when no reports exist', async () => {
  const controller = controllerFactory({}, true);
  const res = createMockRes();

  await controller.listReports(publicReq(), res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonData, { data: [] });
});

test('createSnapshot returns 403 for non-admin', async () => {
  const controller = controllerFactory({}, true);
  const res = createMockRes();

  await controller.createSnapshot(
    adminReq({ user: { id: '1', role: 'player' } }),
    res,
    next
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonData.error, 'ADMIN_REQUIRED');
});

test('createSnapshot creates version 0 published report', async () => {
  const controller = controllerFactory({}, true);
  const res = createMockRes();

  await controller.createSnapshot(adminReq(), res, next);

  assert.equal(res.statusCode, 201);
  assert.equal(res.jsonData.data.version, 0);
  assert.equal(res.jsonData.data.status, 'published');
  assert.equal(res.jsonData.data.event_uuid, 'evt-uuid-1');
});

test('createSnapshot returns 409 when snapshot already exists', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const res = createMockRes();
  await controller.createSnapshot(adminReq(), res, next);

  assert.equal(res.statusCode, 409);
  assert.equal(res.jsonData.error, 'SNAPSHOT_ALREADY_EXISTS');
});

test('getCurrentReport returns the published snapshot', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const res = createMockRes();
  await controller.getCurrentReport(publicReq(), res, next);

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonData.data.version, 0);
});

test('getReportByVersion returns specific published version', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const res = createMockRes();
  await controller.getReportByVersion(
    publicReq({ params: { version: '0' } }),
    res,
    next
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonData.data.version, 0);
});

test('createDraft creates a draft from provided reportJson', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const res = createMockRes();
  await controller.createDraft(
    adminReq({ body: { reportJson: { edited: true } } }),
    res,
    next
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.jsonData.data.status, 'draft');
  assert.equal(res.jsonData.data.version, null);
  assert.deepEqual(res.jsonData.data.report_json, { edited: true });
});

test('updateDraft updates draft reportJson', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const createRes = createMockRes();
  await controller.createDraft(
    adminReq({ body: { reportJson: { edited: true } } }),
    createRes,
    next
  );
  const draftId = createRes.jsonData.data.id;

  const updateRes = createMockRes();
  await controller.updateDraft(
    adminReq({
      params: { draftId: String(draftId) },
      body: { reportJson: { edited: false } },
    }),
    updateRes,
    next
  );

  assert.equal(updateRes.statusCode, 200);
  assert.deepEqual(updateRes.jsonData.data.report_json, { edited: false });
});

test('publishDraft assigns next version and marks published', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const createRes = createMockRes();
  await controller.createDraft(
    adminReq({ body: { reportJson: { edited: true } } }),
    createRes,
    next
  );
  const draftId = createRes.jsonData.data.id;

  const publishRes = createMockRes();
  await controller.publishDraft(
    adminReq({ params: { draftId: String(draftId) } }),
    publishRes,
    next
  );

  assert.equal(publishRes.statusCode, 200);
  assert.equal(publishRes.jsonData.data.status, 'published');
  assert.equal(publishRes.jsonData.data.version, 1);
});

test('deleteReport removes a draft', async () => {
  const controller = controllerFactory({}, true);
  await controller.createSnapshot(adminReq(), createMockRes(), next);

  const createRes = createMockRes();
  await controller.createDraft(adminReq(), createRes, next);
  const draftId = createRes.jsonData.data.id;

  const deleteRes = createMockRes();
  await controller.deleteReport(
    adminReq({ params: { draftId: String(draftId) } }),
    deleteRes,
    next
  );

  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.jsonData.message, 'Report deleted');
});

test('deleteReport refuses to delete original snapshot', async () => {
  const controller = controllerFactory({}, true);
  const createRes = createMockRes();
  await controller.createSnapshot(adminReq(), createRes, next);
  const snapshotId = createRes.jsonData.data.id;

  const deleteRes = createMockRes();
  await controller.deleteReport(
    adminReq({ params: { draftId: String(snapshotId) } }),
    deleteRes,
    next
  );

  assert.equal(deleteRes.statusCode, 403);
  assert.equal(deleteRes.jsonData.error, 'CANNOT_DELETE_ORIGINAL');
});
