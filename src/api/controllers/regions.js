const { II } = require("../../lib/logging");
const dbService = require("../services/dbService");

module.exports = (db) => {
  const dbSvc = dbService(db);

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

