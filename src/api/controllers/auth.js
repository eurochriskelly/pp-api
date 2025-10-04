module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/auth')
    : require('../services/auth');
  const dbSvc = serviceFactory(db);

  return {
    /**
     * Create a new user account
     * @param {Object} req - Express request object
     * @param {Object} req.body - Request body
     * @param {string} req.body.email - User email address
     * @param {string} req.body.password - User password
     * @param {string} [req.body.role] - User role (optional)
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with user data or error
     */
    signup: async (req, res) => {
      const { email, password, role } = req.body;
      try {
        if (!email || !password) {
          return res
            .status(400)
            .json({ error: 'Email and password are required' });
        }
        const result = await dbSvc.signup(email, password, role);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },

    /**
     * Authenticate a user and return a token
     * @param {Object} req - Express request object
     * @param {Object} req.body - Request body
     * @param {string} req.body.email - User email address
     * @param {string} req.body.password - User password
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with authentication token or error
     */
    login: async (req, res) => {
      const { email, password } = req.body;
      try {
        if (!email || !password) {
          return res
            .status(400)
            .json({ error: 'Email and password are required' });
        }
        const result = await dbSvc.login(email, password);
        res.json(result);
      } catch (err) {
        res.status(401).json({ error: err.message });
      }
    },

    /**
     * Logout a user by invalidating their token
     * @param {Object} req - Express request object
     * @param {Object} req.headers - Request headers
     * @param {string} [req.headers.authorization] - Bearer token in Authorization header
     * @param {Object} req.body - Request body (fallback for token)
     * @param {string} [req.body.token] - Token in request body
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response confirming logout
     */
    logout: async (req, res) => {
      const authHeader = req.headers.authorization;
      let token;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7, authHeader.length);
      } else {
        token = req.body.token;
      }

      try {
        // as client is responsible for discarding it.
        const result = await dbSvc.logout(token);
        res.json(result);
      } catch {
        // This path should ideally not be hit in mock if logout is permissive
        res
          .status(500)
          .json({ error: 'An unexpected error occurred during logout.' });
      }
    },

    /**
     * Get current authenticated user information
     * @param {Object} req - Express request object
     * @param {Object} req.headers - Request headers
     * @param {string} req.headers.authorization - Bearer token in Authorization header
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with user data or error
     */
    getCurrentUser: async (req, res) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7, authHeader.length);
        try {
          const user = await dbSvc.verifyToken(token);
          res.json(user);
        } catch {
          res.status(401).json({ error: 'Invalid or expired token' });
        }
      } else {
        res.status(401).json({ error: 'Authorization token required' });
      }
    },

    getUsers: async (req, res) => {
      const { filter } = req.query;
      try {
        const users = await dbSvc.getUsers(filter);
        res.json({ data: users });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  };
};
