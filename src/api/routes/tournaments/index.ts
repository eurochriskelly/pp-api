import express from 'express';
import tournamentController from '../../controllers/tournaments';
import { validateNumericId, validateUUID } from '../../middleware/validation';
const authMiddlewareFactory = require('../../middleware/auth');

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
  router.get(
    '/:tournamentId',
    validateNumericId('tournamentId'),
    ctrl.getTournament
  );
  router.get(
    '/:tournamentId/report',
    validateNumericId('tournamentId'),
    ctrl.getTournamentReport
  );
  router.get(
    '/:tournamentId/report-cache',
    validateNumericId('tournamentId'),
    ctrl.getTournamentReportCache
  );
  router.put(
    '/:tournamentId/report',
    validateNumericId('tournamentId'),
    ctrl.buildTournamentReport
  );
  router.put(
    '/:tournamentId',
    validateNumericId('tournamentId'),
    ctrl.updateTournament
  );
  router.put(
    '/:tournamentId/status/:status',
    validateNumericId('tournamentId'),
    ctrl.updateTournamentStatus
  );
  router.delete(
    '/:tournamentId',
    validateNumericId('tournamentId'),
    ctrl.deleteTournament
  );
  router.get('/by-uuid/:uuid', validateUUID('uuid'), ctrl.getTournament);
  router.post(
    '/:tournamentId/reset',
    validateNumericId('tournamentId'),
    ctrl.resetTournament
  );
  router.post(
    '/:tournamentId/validate-tsv',
    validateNumericId('tournamentId'),
    ctrl.validateTsv
  );
  router.post(
    '/:tournamentId/generate-fixtures',
    validateNumericId('tournamentId'),
    ctrl.generateFixtures
  );
  router.get(
    '/:tournamentId/recent-matches',
    validateNumericId('tournamentId'),
    ctrl.getRecentMatches
  );
  router.get(
    '/:tournamentId/categories',
    validateNumericId('tournamentId'),
    ctrl.getTournamentCategories
  );
  router.get(
    '/:tournamentId/group-fixtures',
    validateNumericId('tournamentId'),
    ctrl.getGroupFixtures
  );
  router.get(
    '/:tournamentId/group-standings',
    validateNumericId('tournamentId'),
    ctrl.getGroupStandings
  );
  router.get(
    '/:tournamentId/knockout-fixtures',
    validateNumericId('tournamentId'),
    ctrl.getKnockoutFixtures
  );
  router.get(
    '/:tournamentId/finals-results',
    validateNumericId('tournamentId'),
    ctrl.getFinalsResults
  );
  router.get(
    '/:tournamentId/all-matches',
    validateNumericId('tournamentId'),
    ctrl.getAllMatches
  );
  router.get(
    '/:tournamentId/clubs',
    validateNumericId('tournamentId'),
    ctrl.getTournamentClubs
  );
  router.get(
    '/:tournamentId/filters',
    validateNumericId('tournamentId'),
    ctrl.getFilters
  );
  router.get(
    '/:tournamentId/code-check/:code',
    validateNumericId('tournamentId'),
    ctrl.codeCheck
  );
  router.get(
    '/:tournamentId/matches-by-pitch',
    validateNumericId('tournamentId'),
    ctrl.getMatchesByPitch
  );
  router.get(
    '/:tournamentId/carded-players',
    validateNumericId('tournamentId'),
    ctrl.getCardedPlayers
  );
  router.post(
    '/:tournamentId/squads',
    validateNumericId('tournamentId'),
    ctrl.createSquad
  );
  router.get(
    '/:tournamentId/squads',
    validateNumericId('tournamentId'),
    ctrl.getSquads
  );
  router.get(
    '/:tournamentId/squads/:squadId',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    ctrl.getSquad
  );
  router.put(
    '/:tournamentId/squads/:squadId',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    ctrl.updateSquad
  );
  router.delete(
    '/:tournamentId/squads/:squadId',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    ctrl.deleteSquad
  );
  router.post(
    '/:tournamentId/squads/:squadId/players',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    ctrl.createPlayer
  );
  router.get(
    '/:tournamentId/squads/:squadId/players',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    ctrl.getPlayers
  );
  router.get(
    '/:tournamentId/squads/:squadId/players/:playerId',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    validateNumericId('playerId'),
    ctrl.getPlayer
  );
  router.put(
    '/:tournamentId/squads/:squadId/players/:playerId',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    validateNumericId('playerId'),
    ctrl.updatePlayer
  );
  router.delete(
    '/:tournamentId/squads/:squadId/players/:playerId',
    validateNumericId('tournamentId'),
    validateNumericId('squadId'),
    validateNumericId('playerId'),
    ctrl.deletePlayer
  );
  router.delete(
    '/:tournamentId/fixtures',
    validateNumericId('tournamentId'),
    ctrl.deleteFixtures
  );
  router.delete(
    '/:tournamentId/pitches',
    validateNumericId('tournamentId'),
    ctrl.deletePitches
  );
  router.delete(
    '/:tournamentId/cards',
    validateNumericId('tournamentId'),
    ctrl.deleteCards
  );
  router.post(
    '/:tournamentId/pitches',
    validateNumericId('tournamentId'),
    ctrl.createPitches
  );
  router.post(
    '/:tournamentId/fixtures',
    validateNumericId('tournamentId'),
    ctrl.createFixtures
  );

  router.get(
    '/:tournamentId/overview',
    validateNumericId('tournamentId'),
    ctrl.getTournamentOverview
  );
  router.get(
    '/:tournamentId/integrity-check',
    validateNumericId('tournamentId'),
    ctrl.integrityCheck
  );
  router.get(
    '/:tournamentId/organizers',
    validateNumericId('tournamentId'),
    ctrl.getOrganizers
  );
  router.put(
    '/:tournamentId/organizers/:userId',
    validateNumericId('tournamentId'),
    validateNumericId('userId'),
    ctrl.assignOrganizer
  );
  router.get(
    '/:tournamentId/club/:clubId/logo',
    validateNumericId('tournamentId'),
    validateNumericId('clubId'),
    ctrl.getClubLogo
  );

  return router;
};
