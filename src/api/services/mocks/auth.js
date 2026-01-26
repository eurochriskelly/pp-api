// Mock service for authentication
const { II, DD } = require('../../../lib/logging');

// In-memory store for users and mock tokens
let users = {
  'p@pp.com': {
    id: 'player1',
    email: 'p@pp.com',
    name: 'Player One',
    password: 'p',
    role: 'player',
  },
  'o@pp.com': {
    id: 'organizer1',
    email: 'o@pp.com',
    name: 'Organizer One',
    password: 'o',
    role: 'organizer',
  },
  'r@pp.com': {
    id: 'referee1',
    email: 'r@pp.com',
    name: 'Referee One',
    password: 'r',
    role: 'referee',
  },
};
let activeTokens = {}; // Store active mock tokens: { token: email }
const otpStore = new Map();

module.exports = () => {
  // db parameter is kept for consistency, not used by mocks
  II('Auth mock service initialized with in-memory user store (using emails)');

  return {
    signup: async (email) => {
      II(`Mock: signup attempt for email [${email}]`);
      if (!users[email]) {
        DD(`Mock: Signup failed - email [${email}] not found.`);
        throw new Error('User not found');
      }
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 600 * 1000;
      otpStore.set(email, { code: otp, expires });
      II(`Mock: OTP [${otp}] sent to [${email}] (logged, no real email)`);
      return { data: { ttl: 600 } };
    },

    verify: async (email, code) => {
      II(`Mock: verify attempt for email [${email}], code [${code}]`);
      const stored = otpStore.get(email);
      if (!stored || Date.now() > stored.expires || stored.code !== code) {
        throw new Error('Invalid or expired code');
      }
      otpStore.delete(email);

      const user = users[email];
      if (!user) throw new Error('User not found');

      const token = `mock-token-for-${email}-${Date.now()}`;
      activeTokens[token] = email;
      return {
        message: 'Verification successful',
        user: {
          username: user.email,
          role: user.role,
          email: user.email,
          id: user.id,
        },
        token,
      };
    },

    login: async (email, password) => {
      II(`Mock: login attempt for email [${email}]`);
      const user = users[email];
      if (user && user.password === password) {
        const token = `mock-token-for-${email}-${Date.now()}`;
        activeTokens[token] = email; // Store the token as active
        DD(`Mock: Login successful for [${email}]. Token: ${token}`);
        return {
          message: 'Login successful',
          user: {
            username: user.email,
            role: user.role,
            email: user.email,
            id: user.id,
            name: user.name,
          },
          token,
        };
      }
      DD(`Mock: Login failed for [${email}] - invalid credentials.`);
      throw new Error('Invalid email or password');
    },

    logout: async (token) => {
      II(`Mock: logout attempt for token [${token}]`);
      if (activeTokens[token]) {
        delete activeTokens[token];
        DD(`Mock: Token [${token}] invalidated.`);
      }
      return { message: 'Logout successful' };
    },

    register: async (email, name /* club */) => {
      II(`Mock: register attempt for email [${email}]`);
      if (users[email]) {
        throw new Error('Email already exists');
      }
      const newUser = {
        id: `mock-id-${Object.keys(users).length + 1}`,
        email,
        name,
        club_id: null,
        role: 'player',
      };
      users[email] = newUser;
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(email, { code: otp, expires: Date.now() + 600 * 1000 });
      II(`Mock: OTP [${otp}] sent to new user [${email}]`);
      DD(`Mock: User created:`, newUser);
      return {
        message: 'User created, OTP sent',
        data: { ttl: 600 },
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      };
    },

    verifyToken: async (token) => {
      II(`Mock: verifyToken attempt for token [${token}]`);
      const email = activeTokens[token];
      if (email && users[email]) {
        const user = users[email];
        DD(`Mock: Token [${token}] is valid for user [${email}].`);
        return {
          username: user.email,
          role: user.role,
          email: user.email,
          id: user.id,
        };
      }
      DD(`Mock: Token [${token}] is invalid or expired.`);
      throw new Error('Invalid or expired token');
    },
  };
};
