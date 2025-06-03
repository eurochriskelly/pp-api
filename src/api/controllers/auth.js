const { II } = require("../../lib/logging");

module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require("../services/mocks/auth")
    : require("../services/auth");
  const dbSvc = serviceFactory(db);

  return {
    signup: async (req, res) => {
      // In mock mode, service expects username, password, role
      // In real mode, service might expect email, password, etc.
      // For this mock, we'll assume username is passed as 'email' for simplicity if adapting existing forms.
      const { email: username, password, role } = req.body; 
      try {
        if (!username || !password) {
          return res.status(400).json({ error: "Username and password are required" });
        }
        const result = await dbSvc.signup(username, password, role);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: err.message }); // e.g., username exists
      }
    },

    login: async (req, res) => {
      // In mock mode, service expects username, password
      // In real mode, service might expect email, password
      const { email: username, password } = req.body;
      try {
        if (!username || !password) {
          return res.status(400).json({ error: "Username and password are required" });
        }
        const result = await dbSvc.login(username, password);
        res.json(result);
      } catch (err) {
        res.status(401).json({ error: err.message });
      }
    },

    logout: async (req, res) => {
      // Mock logout: client should send token in header or body
      // For simplicity, let's assume token is in Authorization header: Bearer <token>
      const authHeader = req.headers.authorization;
      let token;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7, authHeader.length);
      } else {
        // Fallback or alternative: check body if your client sends it there
        token = req.body.token;
      }

      try {
        // Even if token is not provided, mock logout can be considered successful
        // as client is responsible for discarding it.
        const result = await dbSvc.logout(token); 
        res.json(result);
      } catch (err) {
        // This path should ideally not be hit in mock if logout is permissive
        res.status(500).json({ error: "An unexpected error occurred during logout." });
      }
    },

    getCurrentUser: async (req, res) => { // For GET /api/auth/me
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7, authHeader.length);
        try {
          const user = await dbSvc.verifyToken(token);
          res.json(user);
        } catch (err) {
          res.status(401).json({ error: "Invalid or expired token" });
        }
      } else {
        res.status(401).json({ error: "Authorization token required" });
      }
    }
  };
};
