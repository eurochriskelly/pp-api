const { II } = require("../../lib/logging");

module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require("../services/mocks/auth")
    : require("../services/auth");
  const dbSvc = serviceFactory(db);

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
