import express from 'express';
import tournamentController from '../../controllers/tournaments';
import {
  validateNumericId,
  validateTournamentIdentifier,
  validateUUID,
} from '../../middleware/validation';
const authMiddlewareFactory = require('../../middleware/auth');

const PPP_CONTENT_TYPES = new Set([
  'application/zip',
  'application/octet-stream',
  'application/x-zip-compressed',
  'application/vnd.ppp',
]);
const TSV_CONTENT_TYPES = new Set([
  'text/plain',
  'text/tab-separated-values',
  'text/tsv',
]);

const isPppUploadRequest = (req: express.Request): boolean => {
  const rawContentType = req.headers['content-type'];
  if (!rawContentType || typeof rawContentType !== 'string') return false;
  const contentType = rawContentType.split(';')[0].trim().toLowerCase();
  return PPP_CONTENT_TYPES.has(contentType);
};

const isTsvUploadRequest = (req: express.Request): boolean => {
  const rawContentType = req.headers['content-type'];
  if (!rawContentType || typeof rawContentType !== 'string') return false;
  const contentType = rawContentType.split(';')[0].trim().toLowerCase();
  return TSV_CONTENT_TYPES.has(contentType);
};

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = tournamentController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);
  const validateTournamentId = validateTournamentIdentifier(db, useMock);

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
    validateTournamentId,
    ctrl.getTournament
  );
  router.get(
    '/:tournamentId/report',
    validateTournamentId,
    ctrl.getTournamentReport
  );
  router.get(
    '/:tournamentId/report-cache',
    validateTournamentId,
    ctrl.getTournamentReportCache
  );
  router.put(
    '/:tournamentId/report',
    validateTournamentId,
    ctrl.buildTournamentReport
  );
  router.put(
    '/:tournamentId',
    validateTournamentId,
    ctrl.updateTournament
  );
  router.put(
    '/:tournamentId/status/:status',
    validateTournamentId,
    ctrl.updateTournamentStatus
  );
  router.delete(
    '/:tournamentId',
    validateTournamentId,
    ctrl.deleteTournament
  );
  router.get('/by-uuid/:uuid', validateUUID('uuid'), ctrl.getTournament);
  router.post(
    '/:tournamentId/reset',
    validateTournamentId,
    ctrl.resetTournament
  );
  router.post(
    '/:tournamentId/validate-tsv',
    validateTournamentId,
    ctrl.validateTsv
  );
  router.post(
    '/:tournamentId/generate-fixtures',
    validateTournamentId,
    ctrl.generateFixtures
  );
  router.get(
    '/:tournamentId/recent-matches',
    validateTournamentId,
    ctrl.getRecentMatches
  );
  router.get(
    '/:tournamentId/categories',
    validateTournamentId,
    ctrl.getTournamentCategories
  );
  router.get(
    '/:tournamentId/group-fixtures',
    validateTournamentId,
    ctrl.getGroupFixtures
  );
  router.get(
    '/:tournamentId/group-standings',
    validateTournamentId,
    ctrl.getGroupStandings
  );
  router.get(
    '/:tournamentId/knockout-fixtures',
    validateTournamentId,
    ctrl.getKnockoutFixtures
  );
  router.get(
    '/:tournamentId/finals-results',
    validateTournamentId,
    ctrl.getFinalsResults
  );
  router.get(
    '/:tournamentId/all-matches',
    validateTournamentId,
    ctrl.getAllMatches
  );
  router.get(
    '/:tournamentId/clubs',
    validateTournamentId,
    ctrl.getTournamentClubs
  );
  router.get(
    '/:tournamentId/filters',
    validateTournamentId,
    ctrl.getFilters
  );
  router.get(
    '/:tournamentId/code-check/:code',
    validateTournamentId,
    ctrl.codeCheck
  );
  router.get(
    '/:tournamentId/matches-by-pitch',
    validateTournamentId,
    ctrl.getMatchesByPitch
  );
  router.get(
    '/:tournamentId/carded-players',
    validateTournamentId,
    ctrl.getCardedPlayers
  );
  router.post(
    '/:tournamentId/squads',
    validateTournamentId,
    ctrl.createSquad
  );
  router.get(
    '/:tournamentId/squads',
    validateTournamentId,
    ctrl.getSquads
  );
  router.get(
    '/:tournamentId/squads/:squadId',
    validateTournamentId,
    validateNumericId('squadId'),
    ctrl.getSquad
  );
  router.put(
    '/:tournamentId/squads/:squadId',
    validateTournamentId,
    validateNumericId('squadId'),
    ctrl.updateSquad
  );
  router.delete(
    '/:tournamentId/squads/:squadId',
    validateTournamentId,
    validateNumericId('squadId'),
    ctrl.deleteSquad
  );
  router.post(
    '/:tournamentId/squads/:squadId/players',
    validateTournamentId,
    validateNumericId('squadId'),
    ctrl.createPlayer
  );
  router.get(
    '/:tournamentId/squads/:squadId/players',
    validateTournamentId,
    validateNumericId('squadId'),
    ctrl.getPlayers
  );
  router.get(
    '/:tournamentId/squads/:squadId/players/:playerId',
    validateTournamentId,
    validateNumericId('squadId'),
    validateNumericId('playerId'),
    ctrl.getPlayer
  );
  router.put(
    '/:tournamentId/squads/:squadId/players/:playerId',
    validateTournamentId,
    validateNumericId('squadId'),
    validateNumericId('playerId'),
    ctrl.updatePlayer
  );
  router.delete(
    '/:tournamentId/squads/:squadId/players/:playerId',
    validateTournamentId,
    validateNumericId('squadId'),
    validateNumericId('playerId'),
    ctrl.deletePlayer
  );
  router.delete(
    '/:tournamentId/fixtures',
    validateTournamentId,
    ctrl.deleteFixtures
  );
  router.delete(
    '/:tournamentId/pitches',
    validateTournamentId,
    ctrl.deletePitches
  );
  router.delete(
    '/:tournamentId/cards',
    validateTournamentId,
    ctrl.deleteCards
  );
  router.post(
    '/:tournamentId/pitches',
    validateTournamentId,
    ctrl.createPitches
  );
  router.post(
    '/:tournamentId/fixtures',
    validateTournamentId,
    express.raw({
      type: isTsvUploadRequest,
      limit: '10mb',
    }),
    ctrl.createFixtures
  );

  router.get(
    '/:tournamentId/overview',
    validateTournamentId,
    ctrl.getTournamentOverview
  );
  router.get(
    '/:tournamentId/integrity-check',
    validateTournamentId,
    ctrl.integrityCheck
  );
  router.get(
    '/:tournamentId/organizers',
    validateTournamentId,
    ctrl.getOrganizers
  );
  router.put(
    '/:tournamentId/organizers/:userId',
    validateTournamentId,
    validateNumericId('userId'),
    ctrl.assignOrganizer
  );
  router.get(
    '/:tournamentId/club/:clubId/logo',
    validateTournamentId,
    validateNumericId('clubId'),
    ctrl.getClubLogo
  );

  return router;
};
