const express = require("express");
const generalController = require("../controllers/general");

module.exports = (db) => {
  const router = express.Router({mergeParams: true});
  const ctrl = generalController(db);

  router.get("/tournaments/:tournamentId/pitches", ctrl.listPitches);
  router.get("/tournaments/:tournamentId/teams", ctrl.listTeams);
  router.get("/tournaments/:tournamentId/standings", ctrl.listStandings);

  return router;
};
