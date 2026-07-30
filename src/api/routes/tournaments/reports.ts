import express from 'express';
import tournamentReportsController from '../../controllers/tournament-reports';
import authMiddlewareFactory from '../../middleware/auth';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = tournamentReportsController(dbMain, useMock);
  const protect = authMiddlewareFactory(dbMain, useMock);

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
