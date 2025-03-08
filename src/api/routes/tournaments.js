const express = require("express");
const tournamentController = require("../controllers/tournaments");

module.exports = (db) => {
  const router = express.Router({mergeParams: true});
  const ctrl = tournamentController(db);

  router.post("/", ctrl.createTournament);
  router.get("/", ctrl.getTournaments);
  router.get("/:id", ctrl.getTournament);
  router.put("/:id", ctrl.updateTournament);
  router.delete("/:id", ctrl.deleteTournament);
  router.get("/by-uuid/:uuid", ctrl.getTournament);
  router.post("/:id/reset", ctrl.resetTournament);
  router.get("/:id/recent-matches", ctrl.getRecentMatches);
  router.get("/:id/categories", ctrl.getTournamentCategories);
  router.get("/:id/group-fixtures", ctrl.getGroupFixtures);
  router.get("/:id/group-standings", ctrl.getGroupStandings);
  router.get("/:id/knockout-fixtures", ctrl.getKnockoutFixtures);
  router.get("/:id/finals-results", ctrl.getFinalsResults);
  router.get("/:id/all-matches", ctrl.getAllMatches);

  router.get("/:tournamentId/matches-by-pitch", ctrl.getMatchesByPitch);
  router.get("/:tournamentId/carded-players", ctrl.getCardedPlayers);

  // Squads sub-resource (replaces teams)
  router.post("/:tournamentId/squads", ctrl.createSquad);
  router.get("/:tournamentId/squads", ctrl.getSquads);
  router.get("/:tournamentId/squads/:id", ctrl.getSquad);
  router.put("/:tournamentId/squads/:id", ctrl.updateSquad);
  router.delete("/:tournamentId/squads/:id", ctrl.deleteSquad);

  // Players sub-resource (under squads)
  router.post("/:tournamentId/squads/:squadId/players", ctrl.createPlayer);
  router.get("/:tournamentId/squads/:squadId/players", ctrl.getPlayers);
  router.get("/:tournamentId/squads/:squadId/players/:id", ctrl.getPlayer);
  router.put("/:tournamentId/squads/:squadId/players/:id", ctrl.updatePlayer);
  router.delete("/:tournamentId/squads/:squadId/players/:id", ctrl.deletePlayer);

  // new routes to support import
  router.delete("/:id/fixtures", ctrl.deleteFixtures);
  router.delete("/:id/pitches", ctrl.deletePitches);
  router.delete("/:id/cards", ctrl.deleteCards);
  router.post("/:id/pitches", ctrl.createPitches);
  router.post("/:id/fixtures", ctrl.createFixtures);

  return router;
};
