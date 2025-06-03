const { II } = require("../../lib/logging");

module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require("../services/mocks/regions")
    : require("../services/regions");
  const dbSvc = serviceFactory(db);

  return {
    listRegions: async (req, res) => {
      try {
        const regions = await dbSvc.listRegions();
        res.json({ data: regions });
      } catch (err) {
        throw err;
      }
    },

    listRegionInfo: async (req, res) => {
      try {
        const info = await dbSvc.listRegionInfo(req.params.region, req.query);
        res.json(info);
      } catch (err) {
        throw err;
      }
    },
  };
};

