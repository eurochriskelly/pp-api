module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/regions')
    : require('../services/regions');
  const dbSvc = serviceFactory(db);

  return {
    listRegions: async (req, res) => {
      const regions = await dbSvc.listRegions();
      res.json({ data: regions });
    },

    listRegionInfo: async (req, res) => {
      const info = await dbSvc.listRegionInfo(req.params.region, req.query);
      res.json(info);
    },

    listRegionClubs: async (req, res) => {
      const clubs = await dbSvc.listRegionClubs(req.params.region);
      res.json({ data: clubs });
    },
  };
};
