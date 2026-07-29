import express from 'express';
import tournamentReportsController from '../../controllers/tournament-reports';
const authMiddlewareFactory = require('../../middleware/auth');

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = tournamentReportsController(db, useMock);
  const protect = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listReports);
  router.get('/current', ctrl.getCurrentReport);
  router.get('/versions/:version', ctrl.getReportByVersion);
  router.get('/drafts/:draftId', ctrl.getDraftById);

  router.post('/', protect, ctrl.createSnapshot);
  router.post('/drafts', protect, ctrl.createDraft);
  router.put('/drafts/:draftId', protect, ctrl.updateDraft);
  router.post('/drafts/:draftId/publish', protect, ctrl.publishDraft);
  router.delete('/drafts/:draftId', protect, ctrl.deleteReport);

  return router;
};
