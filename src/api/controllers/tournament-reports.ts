import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import serviceFactory from '../services/tournament-reports';
import mockServiceFactory from '../services/mocks/tournament-reports';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string | number;
    role?: string;
    [key: string]: any;
  };
};

type ValidatedRequest = AuthenticatedRequest & {
  validatedParams?: {
    tournamentId?: number;
    tournamentIdUuid?: string;
    [key: string]: any;
  };
};

const createDraftSchema = z.object({
  reportJson: z.any().optional(),
  basedOnVersion: z.number().int().min(0).optional(),
});

const updateDraftSchema = z.object({
  reportJson: z.any(),
});

function isAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin';
}

function getEventUuid(req: ValidatedRequest): string | undefined {
  return req.validatedParams?.tournamentIdUuid;
}

function getTournamentId(req: ValidatedRequest): number | undefined {
  return req.validatedParams?.tournamentId as number | undefined;
}

function tournamentReportsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    listReports: async (
      req: ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const reports = await dbSvc.listReports(eventUuid);
        res.json({ data: reports });
      } catch (err) {
        next(err);
      }
    },

    getCurrentReport: async (
      req: ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const report = await dbSvc.getCurrentPublished(eventUuid);
        if (!report) {
          res.status(404).json({ error: 'REPORT_NOT_FOUND' });
          return;
        }
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },

    getReportByVersion: async (
      req: ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const version = parseInt(req.params.version, 10);
        if (isNaN(version) || version < 0) {
          res.status(400).json({ error: 'INVALID_VERSION' });
          return;
        }
        const report = await dbSvc.getByVersion(eventUuid, version);
        if (!report) {
          res.status(404).json({ error: 'REPORT_NOT_FOUND' });
          return;
        }
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },

    getDraftById: async (
      req: ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const id = parseInt(req.params.draftId, 10);
        if (isNaN(id) || id <= 0) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }
        const report = await dbSvc.getById(eventUuid, id);
        if (!report) {
          res.status(404).json({ error: 'REPORT_NOT_FOUND' });
          return;
        }
        res.json({ data: report });
      } catch (err) {
        next(err);
      }
    },

    createSnapshot: async (
      req: AuthenticatedRequest & ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!isAdmin(req)) {
          res.status(403).json({ error: 'ADMIN_REQUIRED' });
          return;
        }
        const tournamentId = getTournamentId(req);
        const eventUuid = getEventUuid(req);
        if (!tournamentId || !eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const report = await dbSvc.createSnapshot(
          tournamentId,
          eventUuid,
          req.user?.id
        );
        res.status(201).json({ data: report });
      } catch (err: any) {
        if (err.message === 'SNAPSHOT_ALREADY_EXISTS') {
          res.status(409).json({ error: 'SNAPSHOT_ALREADY_EXISTS' });
          return;
        }
        next(err);
      }
    },

    createDraft: async (
      req: AuthenticatedRequest & ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!isAdmin(req)) {
          res.status(403).json({ error: 'ADMIN_REQUIRED' });
          return;
        }
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const result = createDraftSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            details: result.error.flatten(),
          });
          return;
        }
        const report = await dbSvc.createDraft(
          eventUuid,
          result.data.reportJson,
          req.user?.id,
          result.data.basedOnVersion
        );
        res.status(201).json({ data: report });
      } catch (err: any) {
        if (err.message === 'NO_PUBLISHED_REPORT_TO_DRAFT_FROM') {
          res.status(400).json({ error: 'NO_PUBLISHED_REPORT_TO_DRAFT_FROM' });
          return;
        }
        next(err);
      }
    },

    updateDraft: async (
      req: AuthenticatedRequest & ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!isAdmin(req)) {
          res.status(403).json({ error: 'ADMIN_REQUIRED' });
          return;
        }
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const id = parseInt(req.params.draftId, 10);
        if (isNaN(id) || id <= 0) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }
        const result = updateDraftSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            details: result.error.flatten(),
          });
          return;
        }
        const report = await dbSvc.updateDraft(
          eventUuid,
          id,
          result.data.reportJson,
          req.user?.id
        );
        res.json({ data: report });
      } catch (err: any) {
        if (err.message === 'NOT_FOUND') {
          res.status(404).json({ error: 'REPORT_NOT_FOUND' });
          return;
        }
        if (err.message === 'CANNOT_UPDATE_PUBLISHED_REPORT') {
          res
            .status(409)
            .json({ error: 'CANNOT_UPDATE_PUBLISHED_REPORT' });
          return;
        }
        next(err);
      }
    },

    publishDraft: async (
      req: AuthenticatedRequest & ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!isAdmin(req)) {
          res.status(403).json({ error: 'ADMIN_REQUIRED' });
          return;
        }
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const id = parseInt(req.params.draftId, 10);
        if (isNaN(id) || id <= 0) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }
        const report = await dbSvc.publishDraft(
          eventUuid,
          id,
          req.user?.id
        );
        res.json({ data: report });
      } catch (err: any) {
        if (err.message === 'NOT_FOUND') {
          res.status(404).json({ error: 'REPORT_NOT_FOUND' });
          return;
        }
        if (err.message === 'ALREADY_PUBLISHED') {
          res.status(409).json({ error: 'ALREADY_PUBLISHED' });
          return;
        }
        next(err);
      }
    },

    deleteReport: async (
      req: AuthenticatedRequest & ValidatedRequest,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!isAdmin(req)) {
          res.status(403).json({ error: 'ADMIN_REQUIRED' });
          return;
        }
        const eventUuid = getEventUuid(req);
        if (!eventUuid) {
          res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
          return;
        }
        const id = parseInt(req.params.draftId, 10);
        if (isNaN(id) || id <= 0) {
          res.status(400).json({ error: 'INVALID_ID' });
          return;
        }
        await dbSvc.deleteReport(eventUuid, id);
        res.json({ message: 'Report deleted' });
      } catch (err: any) {
        if (err.message === 'NOT_FOUND') {
          res.status(404).json({ error: 'REPORT_NOT_FOUND' });
          return;
        }
        if (err.message === 'CANNOT_DELETE_ORIGINAL') {
          res.status(403).json({ error: 'CANNOT_DELETE_ORIGINAL' });
          return;
        }
        next(err);
      }
    },
  };
}

export = tournamentReportsController;
