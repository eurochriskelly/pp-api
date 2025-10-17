import { II, DD, EE } from '../lib/logging';
import dbHelper from '../lib/db-helper';

type CacheEntryStatus = 'idle' | 'refreshing' | 'ready' | 'error';

type ReportCacheEntry = {
  data: any | null;
  lastUpdate: string | null;
  lastFetched: number | null;
  status: CacheEntryStatus;
  error?: string | null;
};

type CacheResult =
  | { state: 'hit'; payload: any }
  | { state: 'unchanged'; payload: { tournamentId: number; lastUpdate: string | null } }
  | { state: 'warming'; retryAfter: number; message: string }
  | { state: 'error'; retryAfter: number; message: string }
  | { state: 'disabled'; message: string };

type TournamentReportCacheOptions = {
  db?: any;
  dbSvc: any;
  pollIntervalMs?: number;
  enabled?: boolean;
};

const DEFAULT_INTERVAL_MS = 30_000;

export const createTournamentReportCache = ({
  db,
  dbSvc,
  pollIntervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
}: TournamentReportCacheOptions) => {
  const cache = new Map<number, ReportCacheEntry>();
  const inFlight = new Set<number>();
  let intervalHandle: NodeJS.Timeout | null = null;
  let refreshAllInProgress = false;

  const retryAfterSeconds = Math.max(1, Math.round(pollIntervalMs / 1000));

  const dbOps = db && enabled ? dbHelper(db) : null;

  const ensureEntry = (tournamentId: number) => {
    if (!cache.has(tournamentId)) {
      cache.set(tournamentId, {
        data: null,
        lastUpdate: null,
        lastFetched: null,
        status: 'idle',
        error: null,
      });
    }
    return cache.get(tournamentId)!;
  };

  const refreshTournament = async (
    tournamentId: number,
    reason: 'scheduled' | 'requested' = 'scheduled'
  ) => {
    if (!enabled) return;
    if (inFlight.has(tournamentId)) return;

    const entry = ensureEntry(tournamentId);
    entry.status = 'refreshing';
    entry.error = null;
    inFlight.add(tournamentId);

    try {
      const report = await dbSvc.buildTournamentReport(tournamentId);
      const lastUpdate = report?.lastUpdate ?? null;
      cache.set(tournamentId, {
        data: report,
        lastUpdate,
        lastFetched: Date.now(),
        status: 'ready',
        error: null,
      });
      II(
        `Refreshed tournament report cache for tournament ${tournamentId} (${reason})`
      );
    } catch (err: any) {
      const message = err?.message || 'Failed to build tournament report';
      cache.set(tournamentId, {
        ...entry,
        status: 'error',
        lastFetched: Date.now(),
        error: message,
      });
      EE(
        `Failed to refresh tournament report cache for tournament ${tournamentId}: ${message}`
      );
    } finally {
      inFlight.delete(tournamentId);
    }
  };

  const refreshStartedTournaments = async () => {
    if (!enabled || !dbOps) return;
    if (refreshAllInProgress) {
      DD('Skipping tournament report cache refresh; previous run still active.');
      return;
    }
    refreshAllInProgress = true;
    try {
      const rows = await dbOps.select(
        `SELECT id FROM tournaments WHERE status = ?`,
        ['started']
      );
      const startedIds = new Set<number>(
        rows.map((row: { id: number }) => Number(row.id))
      );

      if (startedIds.size === 0) {
        DD('No started tournaments found during cache refresh.');
      }

      for (const id of startedIds) {
        await refreshTournament(id, 'scheduled');
      }

      for (const cachedId of [...cache.keys()]) {
        if (!startedIds.has(cachedId)) {
          cache.delete(cachedId);
        }
      }
    } catch (err: any) {
      const message = err?.message || 'Unable to load started tournaments';
      EE(`Tournament report cache refresh failed: ${message}`);
    } finally {
      refreshAllInProgress = false;
    }
  };

  const start = () => {
    if (!enabled) {
      DD('Tournament report cache disabled; skipping scheduler start.');
      return;
    }
    if (intervalHandle) return;
    II(
      `Starting tournament report cache scheduler (interval ${pollIntervalMs}ms)`
    );
    void refreshStartedTournaments();
    intervalHandle = setInterval(refreshStartedTournaments, pollIntervalMs);
  };

  const stop = () => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };

  const get = (
    tournamentId: number,
    clientLastUpdate?: string | null
  ): CacheResult => {
    if (!enabled) {
      return {
        state: 'disabled',
        message: 'Tournament report cache is not enabled in this environment.',
      };
    }

    const entry = cache.get(tournamentId);
    if (!entry || entry.status === 'idle') {
      void refreshTournament(tournamentId, 'requested');
      return {
        state: 'warming',
        retryAfter: retryAfterSeconds,
        message: 'Tournament report cache is warming.',
      };
    }

    if (entry.status === 'refreshing') {
      return {
        state: 'warming',
        retryAfter: retryAfterSeconds,
        message: 'Tournament report cache is refreshing.',
      };
    }

    if (entry.status === 'error') {
      void refreshTournament(tournamentId, 'requested');
      return {
        state: 'error',
        retryAfter: retryAfterSeconds,
        message: entry.error || 'Tournament report cache failed to refresh.',
      };
    }

    const cachedLastUpdate = entry.lastUpdate;
    if (
      clientLastUpdate &&
      cachedLastUpdate &&
      clientLastUpdate === cachedLastUpdate
    ) {
      return {
        state: 'unchanged',
        payload: {
          tournamentId,
          lastUpdate: cachedLastUpdate,
        },
      };
    }

    return {
      state: 'hit',
      payload: entry.data,
    };
  };

  return {
    start,
    stop,
    get,
    refreshTournament,
  };
};

export type TournamentReportCache = ReturnType<
  typeof createTournamentReportCache
>;
