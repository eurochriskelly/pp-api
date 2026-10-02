import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import authControllerFactory = require('../../../../src/api/controllers/auth');

describe('auth controller', () => {
  function createMockRes() {
    return {
      statusCode: 200,
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

  const controller = authControllerFactory({}, true);

  it('signup returns OTP metadata for a known mock user', async () => {
    const req: any = { body: { email: 'p@pp.com' } };
    const res: any = createMockRes();
    await controller.signup(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.ttl);
  });

  it('signup returns 400 when email is missing', async () => {
    const req: any = { body: {} };
    const res: any = createMockRes();
    await controller.signup(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'Email is required');
  });

  it('login returns a token for valid credentials', async () => {
    const req: any = { body: { email: 'p@pp.com', password: 'p' } };
    const res: any = createMockRes();
    await controller.login(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, 'p@pp.com');
  });

  it('login returns 401 for invalid credentials', async () => {
    const req: any = { body: { email: 'p@pp.com', password: 'wrong' } };
    const res: any = createMockRes();
    await controller.login(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 401);
  });

  it('verify returns 400 for invalid OTP code', async () => {
    const req: any = { body: { email: 'p@pp.com', code: '000000' } };
    const res: any = createMockRes();
    await controller.verify(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 400);
  });

  it('getCurrentUser returns user for a valid token', async () => {
    const loginReq: any = { body: { email: 'p@pp.com', password: 'p' } };
    const loginRes: any = createMockRes();
    await controller.login(loginReq, loginRes, () => {
      throw new Error('next should not be called');
    });
    const token = loginRes.body.token;

    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res: any = createMockRes();
    await controller.getCurrentUser(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.email, 'p@pp.com');
  });

  it('getCurrentUser returns 401 without token', async () => {
    const req: any = { headers: {} };
    const res: any = createMockRes();
    await controller.getCurrentUser(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 401);
  });

  it('register creates a new user', async () => {
    const req: any = { body: { email: 'new@pp.com', name: 'New User' } };
    const res: any = createMockRes();
    await controller.register(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.user.email, 'new@pp.com');
  });

  it('getUsers returns a list', async () => {
    const req: any = { query: {} };
    const res: any = createMockRes();
    await controller.getUsers(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  it('checkEmail reports existing user', async () => {
    const req: any = { body: { email: 'p@pp.com' } };
    const res: any = createMockRes();
    await controller.checkEmail(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.exists, true);
  });

  it('checkEmail reports missing user', async () => {
    const req: any = { body: { email: 'nobody@pp.com' } };
    const res: any = createMockRes();
    await controller.checkEmail(req, res, () => {
      throw new Error('next should not be called');
    });
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.exists, false);
  });

  it('supports invite registration and code login', async () => {
    const inviteReq: any = { body: { phone: '+31612345678' } };
    const inviteRes: any = createMockRes();
    await controller.createInvite(inviteReq, inviteRes);
    assert.strictEqual(inviteRes.statusCode, 201);

    const token = inviteRes.body.token;
    const statusRes: any = createMockRes();
    await controller.getInviteStatus({ params: { token } } as any, statusRes);
    assert.strictEqual(statusRes.body.status, 'pending');

    const registerRes: any = createMockRes();
    await controller.registerFromInvite(
      {
        params: { token },
        body: { name: 'Invited Player', password: 'password123', clubName: 'New Club' },
      } as any,
      registerRes
    );
    assert.strictEqual(registerRes.statusCode, 201);
    assert.strictEqual(registerRes.body.loginCode, '123456');

    const loginRes: any = createMockRes();
    await controller.loginWithCode(
      { body: { phone: '+31612345678', code: '123456' } } as any,
      loginRes
    );
    assert.strictEqual(loginRes.statusCode, 200);
    assert.ok(loginRes.body.token);
  });
});
