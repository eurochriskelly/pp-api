const { II } = require("../../lib/logging");
const authService = require("../services/auth.service");

module.exports = (db) => {
  const dbSvc = authService(db);

  return {
    login: async (req, res) => {
      const { email, password } = req.body;
      try {
        const user = await dbSvc.login(email, password);
        res.json(user);
      } catch (err) {
        res.status(401).json({ error: err.message });
      }
    },
  };
};
