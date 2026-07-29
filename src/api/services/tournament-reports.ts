import dbHelper from '../../lib/db-helper';
import { buildReport } from './tournaments/build-report/index.js';

interface ReportRecord {
  id: number;
  event_uuid: string;
  version: number | null;
  status: 'draft' | 'published';
  report_json: any;
  created_by: number | null;
  published_by: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const REPORT_COLUMNS = `id, event_uuid, version, status, report_json, created_by, published_by, published_at, created_at, updated_at`;

function parseUserId(userId: string | number | undefined): number | null {
  if (userId === undefined || userId === null) return null;
  const numeric = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  return isNaN(numeric) ? null : numeric;
}

function parseReportJson(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function rowToRecord(row: any): ReportRecord {
  return {
    ...row,
    report_json: parseReportJson(row.report_json),
  };
}

function tournamentReportsService(db: any) {
  const { select, insert, update, delete: remove, transaction } = dbHelper(db);

  return {
    listReports: async (eventUuid: string): Promise<ReportRecord[]> => {
      const rows = await select(
        `SELECT ${REPORT_COLUMNS}
         FROM tournament_reports
         WHERE event_uuid = ?
         ORDER BY status = 'published' DESC, version IS NULL, version DESC, created_at DESC`,
        [eventUuid]
      );
      return rows.map(rowToRecord);
    },

    getCurrentPublished: async (
      eventUuid: string
    ): Promise<ReportRecord | null> => {
      const rows = await select(
        `SELECT ${REPORT_COLUMNS}
         FROM tournament_reports
         WHERE event_uuid = ? AND status = 'published'
         ORDER BY version DESC
         LIMIT 1`,
        [eventUuid]
      );
      return rows[0] ? rowToRecord(rows[0]) : null;
    },

    getByVersion: async (
      eventUuid: string,
      version: number
    ): Promise<ReportRecord | null> => {
      const rows = await select(
        `SELECT ${REPORT_COLUMNS}
         FROM tournament_reports
         WHERE event_uuid = ? AND version = ? AND status = 'published'`,
        [eventUuid, version]
      );
      return rows[0] ? rowToRecord(rows[0]) : null;
    },

    getById: async (
      eventUuid: string,
      id: number
    ): Promise<ReportRecord | null> => {
      const rows = await select(
        `SELECT ${REPORT_COLUMNS}
         FROM tournament_reports
         WHERE event_uuid = ? AND id = ?`,
        [eventUuid, id]
      );
      return rows[0] ? rowToRecord(rows[0]) : null;
    },

    createSnapshot: async (
      tournamentId: number,
      eventUuid: string,
      userId?: string | number
    ): Promise<ReportRecord> => {
      return transaction(async (tx) => {
        const existing = await tx.select(
          `SELECT id FROM tournament_reports WHERE event_uuid = ? AND version = 0 AND status = 'published'`,
          [eventUuid]
        );
        if (existing.length > 0) {
          throw new Error('SNAPSHOT_ALREADY_EXISTS');
        }

        const report = await buildReport(tournamentId, tx.select);
        const createdBy = parseUserId(userId);

        const insertId = await tx.insert(
          `INSERT INTO tournament_reports (event_uuid, version, status, report_json, created_by, published_by, published_at)
           VALUES (?, 0, 'published', ?, ?, ?, NOW())`,
          [eventUuid, JSON.stringify(report), createdBy, createdBy]
        );

        const rows = await tx.select(
          `SELECT ${REPORT_COLUMNS} FROM tournament_reports WHERE id = ?`,
          [insertId]
        );
        return rowToRecord(rows[0]);
      });
    },

    createDraft: async (
      eventUuid: string,
      reportJson: any,
      userId?: string | number,
      basedOnVersion?: number
    ): Promise<ReportRecord> => {
      let report = reportJson;
      if (report === undefined) {
        const base =
          basedOnVersion !== undefined
            ? await select(
                `SELECT report_json FROM tournament_reports WHERE event_uuid = ? AND version = ? AND status = 'published'`,
                [eventUuid, basedOnVersion]
              )
            : await select(
                `SELECT report_json FROM tournament_reports WHERE event_uuid = ? AND status = 'published' ORDER BY version DESC LIMIT 1`,
                [eventUuid]
              );
        if (!base[0]) {
          throw new Error('NO_PUBLISHED_REPORT_TO_DRAFT_FROM');
        }
        report = parseReportJson(base[0].report_json);
      }

      const createdBy = parseUserId(userId);
      const insertId = await insert(
        `INSERT INTO tournament_reports (event_uuid, status, report_json, created_by)
         VALUES (?, 'draft', ?, ?)`,
        [eventUuid, JSON.stringify(report), createdBy]
      );

      const rows = await select(
        `SELECT ${REPORT_COLUMNS} FROM tournament_reports WHERE id = ?`,
        [insertId]
      );
      return rowToRecord(rows[0]);
    },

    updateDraft: async (
      eventUuid: string,
      id: number,
      reportJson: any,
      userId?: string | number
    ): Promise<ReportRecord> => {
      const existing = await select(
        `SELECT status FROM tournament_reports WHERE event_uuid = ? AND id = ?`,
        [eventUuid, id]
      );
      if (!existing[0]) {
        throw new Error('NOT_FOUND');
      }
      if (existing[0].status !== 'draft') {
        throw new Error('CANNOT_UPDATE_PUBLISHED_REPORT');
      }

      const updatedBy = parseUserId(userId);
      await update(
        `UPDATE tournament_reports SET report_json = ?, created_by = COALESCE(?, created_by) WHERE event_uuid = ? AND id = ? AND status = 'draft'`,
        [JSON.stringify(reportJson), updatedBy, eventUuid, id]
      );

      const rows = await select(
        `SELECT ${REPORT_COLUMNS} FROM tournament_reports WHERE id = ?`,
        [id]
      );
      return rowToRecord(rows[0]);
    },

    publishDraft: async (
      eventUuid: string,
      id: number,
      userId?: string | number
    ): Promise<ReportRecord> => {
      return transaction(async (tx) => {
        const draftRows = await tx.select(
          `SELECT status FROM tournament_reports WHERE event_uuid = ? AND id = ?`,
          [eventUuid, id]
        );
        if (!draftRows[0]) {
          throw new Error('NOT_FOUND');
        }
        if (draftRows[0].status !== 'draft') {
          throw new Error('ALREADY_PUBLISHED');
        }

        const versionRows = await tx.select(
          `SELECT MAX(version) as maxVersion FROM tournament_reports WHERE event_uuid = ? AND status = 'published'`,
          [eventUuid]
        );
        const maxVersion =
          typeof versionRows[0]?.maxVersion === 'number'
            ? versionRows[0].maxVersion
            : -1;
        const nextVersion = maxVersion + 1;

        const publishedBy = parseUserId(userId);
        await tx.update(
          `UPDATE tournament_reports
           SET version = ?, status = 'published', published_by = ?, published_at = NOW()
           WHERE event_uuid = ? AND id = ?`,
          [nextVersion, publishedBy, eventUuid, id]
        );

        const rows = await tx.select(
          `SELECT ${REPORT_COLUMNS} FROM tournament_reports WHERE id = ?`,
          [id]
        );
        return rowToRecord(rows[0]);
      });
    },

    deleteReport: async (eventUuid: string, id: number): Promise<void> => {
      const existing = await select(
        `SELECT version, status FROM tournament_reports WHERE event_uuid = ? AND id = ?`,
        [eventUuid, id]
      );
      if (!existing[0]) {
        throw new Error('NOT_FOUND');
      }
      if (existing[0].status === 'published' && existing[0].version === 0) {
        throw new Error('CANNOT_DELETE_ORIGINAL');
      }

      await remove(
        `DELETE FROM tournament_reports WHERE event_uuid = ? AND id = ?`,
        [eventUuid, id]
      );
    },
  };
}

export = tournamentReportsService;
