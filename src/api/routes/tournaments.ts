import express from 'express';
import tournamentController from '../controllers/tournaments';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = tournamentController(db, useMock);
  router.post('/', ctrl.createTournament);
  router.get('/', ctrl.getTournaments);
  router.get('/summary', ctrl.getTournamentsSummary);
  router.get('/by-status/:status', ctrl.getTournamentsByStatus);
  router.get('/:id', ctrl.getTournament);
  router.get('/:id/report', ctrl.getTournamentReport);
  router.put('/:id/report', ctrl.buildTournamentReport);
  router.put('/:id', ctrl.updateTournament);
  router.delete('/:id', ctrl.deleteTournament);
  router.get('/by-uuid/:uuid', ctrl.getTournament);
  router.post('/:id/reset', ctrl.resetTournament);
  router.get('/:id/recent-matches', ctrl.getRecentMatches);
  router.get('/:id/categories', ctrl.getTournamentCategories);
  router.get('/:id/group-fixtures', ctrl.getGroupFixtures);
  router.get('/:id/group-standings', ctrl.getGroupStandings);
  router.get('/:id/knockout-fixtures', ctrl.getKnockoutFixtures);
  router.get('/:id/finals-results', ctrl.getFinalsResults);
  router.get('/:id/all-matches', ctrl.getAllMatches);
  router.get('/:tournamentId/matches-by-pitch', ctrl.getMatchesByPitch);
  router.get('/:tournamentId/carded-players', ctrl.getCardedPlayers);
  router.get('/:tournamentId/squads', ctrl.getSquads);
  router.get('/:tournamentId/squads/:id', ctrl.getSquad);
  router.put('/:tournamentId/squads/:id', ctrl.updateSquad);
  router.delete('/:tournamentId/squads/:id', ctrl.deleteSquad);
  router.post('/:tournamentId/squads/:squadId/players', ctrl.createPlayer);
  router.get('/:tournamentId/squads/:squadId/players', ctrl.getPlayers);
  router.get('/:tournamentId/squads/:squadId/players/:id', ctrl.getPlayer);
  router.put('/:tournamentId/squads/:squadId/players/:id', ctrl.updatePlayer);
  router.delete(
    '/:tournamentId/squads/:squadId/players/:id',
    ctrl.deletePlayer
  );
  router.delete('/:id/fixtures', ctrl.deleteFixtures);
  router.delete('/:id/pitches', ctrl.deletePitches);
  router.delete('/:id/cards', ctrl.deleteCards);
  router.post('/:id/pitches', ctrl.createPitches);
  router.post('/:id/fixtures', ctrl.createFixtures);

  return router;
};
