const { II } = require("../../lib/logging");
const regionsService = require("../services/regions.service");

module.exports = (db) => {
  const regionsSvc = regionsService(db);

  return {
    listRegions: async (req, res) => {
      try {
        const regions = await regionsSvc.listRegions();
        res.json({ data: regions });
      } catch (err) {
        throw err;
      }
    },

    listRegionInfo: async (req, res) => {
      try {
        const info = await regionsSvc.listRegionInfo(req.params.region, req.query);
        res.json(info);
      } catch (err) {
        throw err;
      }
    },
  };
};

