const express = require("express");
const { II } = require("../../lib/logging");
const fixtureController = require("../controllers/fixtures");

module.exports = (db) => {
  const router = express.Router({mergeParams: true});
  const ctrl = fixtureController(db);

  router.get("/", ctrl.fixturesByPitch);
  router.get("/nextup", ctrl.nextFixtures);
  router.get("/pitches/:pitch/fixtures", ctrl.fixturesByPitch);
  router.get("/:fixtureId/rewind", ctrl.rewindFixture);
  router.get("/:fixtureId/carded-players", ctrl.getCardedPlayers);
  router.get("/:fixtureId", ctrl.getFixture);
  // modify
  router.put("/update-calculated-fixtures", ctrl.updateCalculatedFixtures);
  router.put("/:fixtureId/update-calculated-fixtures", ctrl.updateCalculatedFixtures);
  router.post("/:id/start", ctrl.startFixture);
  router.post("/:id/reschedule", ctrl.reschedule);
  router.post("/:id/score", ctrl.updateScore);
  router.post("/:id/carded", ctrl.cardPlayers)

  return router;
};
