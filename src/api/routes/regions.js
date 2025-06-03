const express = require("express");
const regionController = require("../controllers/regions");

module.exports = (db, useMock) => {
  const router = express.Router({mergeParams: true});
  const ctrl = regionController(db, useMock);

  router.get("/", ctrl.listRegions);
  router.get("/:region", ctrl.listRegionInfo);

  return router;
};
