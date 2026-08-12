import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import requireRole = require('../../../../src/api/middleware/authorization');

describe('requireRole middleware', () => {
  function createMockRes() {
    return {
      statusCode: 0,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: unknown) {
        this.body = data;
        return this;
      },
    };
  }

  it('calls next when user has an allowed role', () => {
    const middleware = requireRole(['admin', 'organizer']);
    const req: any = { user: { id: '1', email: 'a@b.com', role: 'admin' } };
    const res: any = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 0);
  });

  it('returns 403 when user role is not allowed', () => {
    const middleware = requireRole(['admin']);
    const req: any = { user: { id: '1', email: 'a@b.com', role: 'player' } };
    const res: any = createMockRes();

    middleware(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.strictEqual(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Forbidden' });
  });

  it('returns 401 when user is not present', () => {
    const middleware = requireRole(['admin']);
    const req: any = {};
    const res: any = createMockRes();

    middleware(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.strictEqual(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authentication required' });
  });
});
