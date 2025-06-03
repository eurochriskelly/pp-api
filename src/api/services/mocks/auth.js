// Mock service for authentication
const { II, DD } = require('../../../lib/logging');

// In-memory store for users and mock tokens
let users = {
  "player": { id: "player1", username: "player", password: "player", role: "player" },
  "organizer": { id: "organizer1", username: "organizer", password: "organizer", role: "organizer" },
  "referee": { id: "referee1", username: "referee", password: "referee", role: "referee" },
};
let activeTokens = {}; // Store active mock tokens: { token: username }

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("Auth mock service initialized with in-memory user store");

  return {
    signup: async (username, password, role = 'player') => {
      II(`Mock: signup attempt for username [${username}] with role [${role}]`);
      if (users[username]) {
        DD(`Mock: Signup failed - username [${username}] already exists.`);
        throw new Error("Username already exists");
      }
      // For mocks, we store passwords as-is. No real hashing.
      const newUser = { id: `mock-id-${Object.keys(users).length + 1}`, username, password, role };
      users[username] = newUser;
      DD(`Mock: User [${username}] created:`, newUser);
      // Automatically log in the user and return a token
      const token = `mock-token-for-${username}-${Date.now()}`;
      activeTokens[token] = username;
      return { 
        message: "Signup successful", 
        user: { id: newUser.id, username: newUser.username, role: newUser.role },
        token 
      };
    },

    login: async (username, password) => {
      II(`Mock: login attempt for username [${username}]`);
      const user = users[username];
      if (user && user.password === password) {
        const token = `mock-token-for-${username}-${Date.now()}`;
        activeTokens[token] = username; // Store the token as active
        DD(`Mock: Login successful for [${username}]. Token: ${token}`);
        return { 
          message: "Login successful", 
          user: { id: user.id, username: user.username, role: user.role },
          token 
        };
      }
      DD(`Mock: Login failed for [${username}] - invalid credentials.`);
      throw new Error("Invalid username or password");
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
      const username = activeTokens[token];
      if (username && users[username]) {
        const user = users[username];
        DD(`Mock: Token [${token}] is valid for user [${username}].`);
        return { id: user.id, username: user.username, role: user.role };
      }
      DD(`Mock: Token [${token}] is invalid or expired.`);
      throw new Error("Invalid or expired token");
    }
  };
};
