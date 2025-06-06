const express = require("express");
const { II } = require("../../lib/logging");
const fixtureController = require("../controllers/fixtures");

module.exports = (db, useMock) => {
  const router = express.Router({mergeParams: true});
  const ctrl = fixtureController(db, useMock);

  router.get("/", ctrl.getFixtures);
  router.get("/nextup", ctrl.nextFixtures);
  router.get("/pitches/:pitch/fixtures", ctrl.getFixtures);
  router.get("/:fixtureId/rewind", ctrl.rewindFixture);
  router.get("/:fixtureId/carded-players", ctrl.getCardedPlayers);
  router.get("/:fixtureId", ctrl.getFixture);
  router.post("/filtered", ctrl.getFilteredFixtures);

  // modify
  router.put("/update-calculated-fixtures", ctrl.updateCalculatedFixtures);
  router.put("/:fixtureId/update-calculated-fixtures", ctrl.updateCalculatedFixtures);

  // create
  router.post("/:id/start", ctrl.startFixture);
  router.post("/:id/end", ctrl.endFixture);
  router.post("/:id/reschedule", ctrl.reschedule);
  router.post("/:id/score", ctrl.updateScore);
  router.post("/:id/carded", ctrl.cardPlayers);


  // Add the new DELETE route
  router.delete("/:id/carded/:cardId", ctrl.deleteCard);

  return router;
};
