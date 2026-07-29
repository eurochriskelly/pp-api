interface MockReport {
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

let mockReports: MockReport[] = [];
let nextId = 1;

function parseUserId(userId: string | number | undefined): number | null {
  if (userId === undefined || userId === null) return null;
  const numeric = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  return isNaN(numeric) ? null : numeric;
}

function mockTournamentReportsService() {
  return {
    __reset: () => {
      mockReports = [];
      nextId = 1;
    },

    listReports: async (eventUuid: string) => {
      return mockReports
        .filter((r) => r.event_uuid === eventUuid)
        .sort((a, b) => {
          if (a.status === 'published' && b.status !== 'published') return -1;
          if (a.status !== 'published' && b.status === 'published') return 1;
          if (a.status === 'published' && b.status === 'published') {
            return (b.version ?? -1) - (a.version ?? -1);
          }
          return b.created_at.localeCompare(a.created_at);
        });
    },

    getCurrentPublished: async (eventUuid: string) => {
      return (
        mockReports
          .filter(
            (r) => r.event_uuid === eventUuid && r.status === 'published'
          )
          .sort((a, b) => (b.version ?? -1) - (a.version ?? -1))[0] || null
      );
    },

    getByVersion: async (eventUuid: string, version: number) => {
      return (
        mockReports.find(
          (r) =>
            r.event_uuid === eventUuid &&
            r.status === 'published' &&
            r.version === version
        ) || null
      );
    },

    getById: async (eventUuid: string, id: number) => {
      return (
        mockReports.find((r) => r.event_uuid === eventUuid && r.id === id) ||
        null
      );
    },

    createSnapshot: async (
      _tournamentId: number,
      eventUuid: string,
      userId?: string | number
    ) => {
      const existing = mockReports.find(
        (r) => r.event_uuid === eventUuid && r.version === 0
      );
      if (existing) {
        throw new Error('SNAPSHOT_ALREADY_EXISTS');
      }
      const now = new Date().toISOString();
      const createdBy = parseUserId(userId);
      const report: MockReport = {
        id: nextId++,
        event_uuid: eventUuid,
        version: 0,
        status: 'published',
        report_json: { snapshot: true },
        created_by: createdBy,
        published_by: createdBy,
        published_at: now,
        created_at: now,
        updated_at: now,
      };
      mockReports.push(report);
      return report;
    },

    createDraft: async (
      eventUuid: string,
      reportJson: any,
      userId?: string | number,
      _basedOnVersion?: number
    ) => {
      const now = new Date().toISOString();
      const createdBy = parseUserId(userId);
      const report: MockReport = {
        id: nextId++,
        event_uuid: eventUuid,
        version: null,
        status: 'draft',
        report_json: reportJson ?? { draft: true },
        created_by: createdBy,
        published_by: null,
        published_at: null,
        created_at: now,
        updated_at: now,
      };
      mockReports.push(report);
      return report;
    },

    updateDraft: async (
      eventUuid: string,
      id: number,
      reportJson: any,
      userId?: string | number
    ) => {
      const report = mockReports.find(
        (r) => r.event_uuid === eventUuid && r.id === id
      );
      if (!report) {
        throw new Error('NOT_FOUND');
      }
      if (report.status !== 'draft') {
        throw new Error('CANNOT_UPDATE_PUBLISHED_REPORT');
      }
      report.report_json = reportJson;
      report.updated_at = new Date().toISOString();
      if (userId !== undefined) {
        report.created_by = parseUserId(userId);
      }
      return report;
    },

    publishDraft: async (
      eventUuid: string,
      id: number,
      userId?: string | number
    ) => {
      const report = mockReports.find(
        (r) => r.event_uuid === eventUuid && r.id === id
      );
      if (!report) {
        throw new Error('NOT_FOUND');
      }
      if (report.status !== 'draft') {
        throw new Error('ALREADY_PUBLISHED');
      }
      const maxVersion = Math.max(
        -1,
        ...mockReports
          .filter(
            (r) =>
              r.event_uuid === eventUuid &&
              r.status === 'published' &&
              r.version !== null
          )
          .map((r) => r.version as number)
      );
      report.version = maxVersion + 1;
      report.status = 'published';
      report.published_by = parseUserId(userId);
      report.published_at = new Date().toISOString();
      report.updated_at = new Date().toISOString();
      return report;
    },

    deleteReport: async (eventUuid: string, id: number) => {
      const index = mockReports.findIndex(
        (r) => r.event_uuid === eventUuid && r.id === id
      );
      if (index === -1) {
        throw new Error('NOT_FOUND');
      }
      const report = mockReports[index];
      if (report.status === 'published' && report.version === 0) {
        throw new Error('CANNOT_DELETE_ORIGINAL');
      }
      mockReports.splice(index, 1);
    },
  };
}

export = mockTournamentReportsService;
