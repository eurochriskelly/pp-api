const authServiceFactory = require('../services/auth');
const authMockServiceFactory = require('../services/mocks/auth');

module.exports = (db, useMock) => {
  const factory = useMock ? authMockServiceFactory : authServiceFactory;
  const authService = factory(db);

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7, authHeader.length);
      try {
        const user = await authService.verifyToken(token);
        req.user = user;
        next();
      } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
      }
    } else {
      res.status(401).json({ error: 'Authorization token required' });
    }
  };
};
