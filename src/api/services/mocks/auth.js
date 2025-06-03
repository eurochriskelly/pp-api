// Mock service for authentication
const { II, DD } = require('../../../lib/logging');

module.exports = (db) => { // db parameter is kept for consistency, not used by mocks
  II("Auth mock service initialized");

  return {
    login: async (email, password) => {
      II(`Mock: login attempt for email [${email}]`);
      // Basic mock login: accept any non-empty email/password for a mock user
      if (email && password) {
        if (email === "test@example.com" && password === "password") {
          const mockUser = { id: "mock-user-123", email: email, message: "Mock login successful" };
          DD("Mock: Login successful for:", mockUser);
          return Promise.resolve(mockUser);
        }
      }
      DD("Mock: Login failed for:", email);
      throw new Error("Mock: Invalid credentials");
    },
  };
};
