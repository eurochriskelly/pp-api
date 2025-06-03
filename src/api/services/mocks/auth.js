// Mock service for authentication
const { II, DD } = require('../../../lib/logging');

// In-memory store for users and mock tokens
let users = {
  "p@pp.com": { id: "player1", email: "p@pp.com", password: "p", role: "player" },
  "o@pp.com": { id: "organizer1", email: "o@pp.com", password: "o", role: "organizer" },
  "r@pp.com": { id: "referee1", email: "r@pp.com", password: "r", role: "referee" },
};
let activeTokens = {}; // Store active mock tokens: { token: email }

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("Auth mock service initialized with in-memory user store (using emails)");

  return {
    signup: async (email, password, role = 'player') => {
      II(`Mock: signup attempt for email [${email}] with role [${role}]`);
      if (users[email]) {
        DD(`Mock: Signup failed - email [${email}] already exists.`);
        throw new Error("Email already exists");
      }
      // For mocks, we store passwords as-is. No real hashing.
      const newUser = { id: `mock-id-${Object.keys(users).length + 1}`, email, password, role };
      users[email] = newUser;
      DD(`Mock: User with email [${email}] created:`, newUser);
      // Automatically log in the user and return a token
      const token = `mock-token-for-${email}-${Date.now()}`;
      activeTokens[token] = email;
      return { 
        message: "Signup successful", 
        user: { username: newUser.email, role: newUser.role, email: newUser.email, id: newUser.id },
        token 
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
          message: "Login successful", 
          user: { username: user.email, role: user.role, email: user.email, id: user.id },
          token 
        };
      }
      DD(`Mock: Login failed for [${email}] - invalid credentials.`);
      throw new Error("Invalid email or password");
    },

    logout: async (token) => {
      II(`Mock: logout attempt for token [${token}]`);
      if (activeTokens[token]) {
        delete activeTokens[token]; // Invalidate the token
        DD(`Mock: Token [${token}] invalidated.`);
        return { message: "Logout successful" };
      }
      DD(`Mock: Token [${token}] not found or already invalidated.`);
      // It's okay if token is not found, client might have already discarded it
      return { message: "Logout successful (token not active or already invalidated)" };
    },

    verifyToken: async (token) => {
      II(`Mock: verifyToken attempt for token [${token}]`);
      const email = activeTokens[token];
      if (email && users[email]) {
        const user = users[email];
        DD(`Mock: Token [${token}] is valid for user [${email}].`);
        return { username: user.email, role: user.role, email: user.email, id: user.id };
      }
      DD(`Mock: Token [${token}] is invalid or expired.`);
      throw new Error("Invalid or expired token");
    }
  };
};
