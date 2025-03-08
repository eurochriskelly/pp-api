const { II } = require("../../lib/logging");
const dbService = require("../services/dbService");

module.exports = (db) => {
  const dbSvc = dbService(db);

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
