module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/clubs')
    : require('../services/clubs');
  const dbSvc = serviceFactory(db);

  return {
    listClubs: async (req, res) => {
      const { search, limit = 10 } = req.query;
      try {
        const clubs = await dbSvc.listClubs(search, parseInt(limit));
        res.json({ data: clubs });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  };
};
