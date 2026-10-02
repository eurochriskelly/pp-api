import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import authMiddleware = require('../../../../src/api/middleware/auth');

describe('auth middleware', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows dev bypass when not in production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PP_BYPASS_AUTH = '1';
    process.env.PP_EMAIL = 'dev@example.com';
    process.env.PP_BYPASS_ROLE = 'admin';

    const middleware = authMiddleware({}, true);
    const req: any = {
      headers: { authorization: 'Bearer dev-bypass-token' },
    };
    let nextCalled = false;

    await middleware(req, {} as any, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.email, 'dev@example.com');
    assert.strictEqual(req.user.role, 'admin');
    assert.strictEqual(req.user.id, 'dev-bypass');
  });

  it('rejects dev bypass in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PP_BYPASS_AUTH = '1';
    process.env.PP_EMAIL = 'dev@example.com';
    process.env.PP_BYPASS_ROLE = 'admin';

    const middleware = authMiddleware({}, true);
    const req: any = {
      headers: { authorization: 'Bearer dev-bypass-token' },
    };
    const res: any = {
      statusCode: 0,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
      },
    };
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Invalid or expired token');
  });

  it('allows tokenless requests in explicitly enabled insecure event mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PP_INSECURE_EVENT_MODE = '1';

    const middleware = authMiddleware({}, true);
    const req: any = { headers: {} };
    let nextCalled = false;

    await middleware(req, {} as any, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.id, 'insecure-event-mode');
    assert.strictEqual(req.user.role, 'admin');
  });
});
