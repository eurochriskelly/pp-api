import express from 'express';
import tournamentController from '../controllers/tournaments';
const authMiddlewareFactory = require('../middleware/auth');

const PPP_CONTENT_TYPES = new Set([
  'application/zip',
  'application/octet-stream',
  'application/x-zip-compressed',
  'application/vnd.ppp',
]);

const isPppUploadRequest = (req: express.Request): boolean => {
  const rawContentType = req.headers['content-type'];
  if (!rawContentType || typeof rawContentType !== 'string') return false;
  const contentType = rawContentType.split(';')[0].trim().toLowerCase();
  return PPP_CONTENT_TYPES.has(contentType);
};

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = tournamentController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.post(
    '/',
    (req, res, next) => {
      void res;
      if (!isPppUploadRequest(req)) {
        next('route');
        return;
      }
      next();
    },
    auth,
    express.raw({
      type: isPppUploadRequest,
      limit: '100mb',
    }),
    ctrl.publishTournamentArchive
  );
  router.post('/', ctrl.createTournament);
  router.get('/', ctrl.getTournaments);
  router.get('/summary', ctrl.getTournamentsSummary);
  router.get('/by-status/:status', ctrl.getTournamentsByStatus);
  router.get('/:id', ctrl.getTournament);
  router.get('/:id/report', ctrl.getTournamentReport);
  router.get('/:id/report-cache', ctrl.getTournamentReportCache);
  router.put('/:id/report', ctrl.buildTournamentReport);
  router.put('/:id', ctrl.updateTournament);
  router.put('/:tournamentId/status/:status', ctrl.updateTournamentStatus);
  router.delete('/:id', ctrl.deleteTournament);
  router.get('/by-uuid/:uuid', ctrl.getTournament);
  router.post('/:id/reset', ctrl.resetTournament);
  router.post('/:id/validate-tsv', ctrl.validateTsv);
  router.post('/:tournamentId/generate-fixtures', ctrl.generateFixtures);
  router.get('/:id/recent-matches', ctrl.getRecentMatches);
  router.get('/:id/categories', ctrl.getTournamentCategories);
  router.get('/:id/group-fixtures', ctrl.getGroupFixtures);
  router.get('/:id/group-standings', ctrl.getGroupStandings);
  router.get('/:id/knockout-fixtures', ctrl.getKnockoutFixtures);
  router.get('/:id/finals-results', ctrl.getFinalsResults);
  router.get('/:id/all-matches', ctrl.getAllMatches);
  router.get('/:tournamentId/clubs', ctrl.getTournamentClubs);
  router.get('/:tournamentId/filters', ctrl.getFilters);
  router.get('/:id/code-check/:code', ctrl.codeCheck);
  router.get('/:tournamentId/matches-by-pitch', ctrl.getMatchesByPitch);
  router.get('/:tournamentId/carded-players', ctrl.getCardedPlayers);
  router.post('/:tournamentId/squads', ctrl.createSquad);
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

  router.get('/:id/overview', ctrl.getTournamentOverview);
  router.get('/:id/integrity-check', ctrl.integrityCheck);
  router.get('/:tournamentId/organizers', ctrl.getOrganizers);
  router.put('/:tournamentId/organizers/:userId', ctrl.assignOrganizer);
  router.get('/:tournamentId/club/:clubId/logo', ctrl.getClubLogo);

  return router;
};
