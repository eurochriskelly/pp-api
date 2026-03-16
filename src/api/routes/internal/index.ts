import express from 'express';

/**
 * Internal/Test-Only Endpoints
 *
 * These endpoints are only available in non-production environments
 * and are used for testing, cleanup, and maintenance tasks.
 *
 * Base: /api/internal
 *
 * Environment Guard: Only mounted when process.env.NODE_ENV !== 'production'
 *
 * Endpoints:
 * - POST /cleanup      - Remove test data and reset database state
 * - POST /reset-mocks  - Reset all mock services to initial state
 * - GET /health        - Detailed health check with DB connectivity
 * - POST /seed         - Seed database with test data
 */
export default (db: any, useMock: boolean, isDev: boolean) => {
  const router = express.Router();
  const debugApiEnabled = process.env.PP_ALLOW_DEBUG_API === '1';

  // Only mount in dev/test environments
  if (!isDev) {
    console.log('[Internal] Routes disabled in production');
    return router;
  }

  console.log('[Internal] Routes enabled for testing');

  /**
   * POST /api/internal/cleanup
   *
   * Remove test data from the database.
   * Useful for cleaning up after test runs.
   *
   * Request Body:
   *   - tables?: string[]  - Specific tables to clean (default: all test tables)
   *   - keepUsers?: boolean - Whether to keep user accounts (default: true)
   *
   * Response: { cleaned: string[], message: string }
   */
  router.post('/cleanup', async (req, res) => {
    try {
      const { select, remove } = require('../../../lib/db-helper')(db);
      const tables = req.body.tables || ['test_resources', 'temp_data'];
      const keepUsers = req.body.keepUsers !== false;

      const cleaned: string[] = [];

      for (const table of tables) {
        try {
          // Safety check - never delete from users table unless explicitly allowed
          if (table === 'users' && keepUsers) {
            console.log(`[Internal] Skipping users table (keepUsers=true)`);
            continue;
          }

          const result = await remove(
            `DELETE FROM ${table} WHERE created_for_test = 1 OR is_test = 1`
          );
          cleaned.push(table);
          console.log(`[Internal] Cleaned ${result} rows from ${table}`);
        } catch (err: any) {
          console.warn(`[Internal] Failed to clean ${table}: ${err.message}`);
        }
      }

      res.json({
        cleaned,
        message: `Cleaned ${cleaned.length} tables`,
        keepUsers,
      });
    } catch (err: any) {
      console.error('[Internal] Cleanup error:', err);
      res.status(500).json({
        error: 'CLEANUP_FAILED',
        message: err.message,
      });
    }
  });

  /**
   * POST /api/internal/reset-mocks
   *
   * Reset all mock services to their initial empty state.
   * Only works when useMock=true.
   *
   * Response: { reset: string[], message: string }
   */
  router.post('/reset-mocks', async (req, res) => {
    if (!useMock) {
      res.status(400).json({
        error: 'MOCK_MODE_REQUIRED',
        message: 'Mock reset only available when useMock=true',
      });
      return;
    }

    try {
      const reset: string[] = [];

      // Dynamically import all mock services
      const mockModules = [
        '../../services/mocks/tournaments',
        '../../services/mocks/listings',
        '../../services/mocks/fixtures',
        '../../services/mocks/auth',
        '../../services/mocks/users',
      ];

      for (const modulePath of mockModules) {
        try {
          const mockModule = require(modulePath);
          const mockFactory = mockModule.default || mockModule;
          const mock = mockFactory();

          if (mock.__reset) {
            mock.__reset();
            reset.push(modulePath.split('/').pop());
          }
        } catch (err) {
          // Module might not exist, skip
        }
      }

      console.log('[Internal] Reset mocks:', reset);
      res.json({
        reset,
        message: `Reset ${reset.length} mock services`,
      });
    } catch (err: any) {
      console.error('[Internal] Reset error:', err);
      res.status(500).json({
        error: 'RESET_FAILED',
        message: err.message,
      });
    }
  });

  /**
   * GET /api/internal/health
   *
   * Detailed health check including database connectivity.
   * More verbose than the public /health endpoint.
   *
   * Response: { status: string, checks: object, timestamp: string }
   */
  router.get('/health', async (req, res) => {
    try {
      const { select } = require('../../../lib/db-helper')(db);

      // Check database connectivity
      const startTime = Date.now();
      const [dbCheck] = await select('SELECT 1 as check_val');
      const dbLatency = Date.now() - startTime;

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mode: useMock ? 'mock' : 'database',
        checks: {
          database: {
            status: dbCheck ? 'ok' : 'error',
            latency_ms: dbLatency,
          },
          memory: {
            used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
          uptime: {
            seconds: Math.round(process.uptime()),
          },
        },
      };

      res.json(health);
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: err.message,
      });
    }
  });

  /**
   * GET /api/internal/schema
   *
   * Return DB schema metadata from information_schema for debugging.
   *
   * Query params:
   *   - table?: string | string[] (comma-separated or repeated)
   *
   * Example:
   *   /api/internal/schema?table=tournaments,fixtures,squads
   */
  router.get('/schema', async (req, res) => {
    if (!db) {
      res.status(400).json({
        error: 'DB_CONNECTION_REQUIRED',
        message: 'Schema inspection requires a live DB connection',
      });
      return;
    }

    try {
      const { select } = require('../../../lib/db-helper')(db);

      const rawTableQuery = req.query.table;
      const requestedTables = Array.isArray(rawTableQuery)
        ? rawTableQuery
            .flatMap((v) => String(v).split(','))
            .map((v) => v.trim())
            .filter(Boolean)
        : typeof rawTableQuery === 'string'
          ? rawTableQuery
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : [];

      const safeRequestedTables = requestedTables.filter((table) =>
        /^[a-zA-Z0-9_]+$/.test(table)
      );

      const dbRows = await select('SELECT DATABASE() AS db_name');
      const dbName = dbRows?.[0]?.db_name;
      if (!dbName) {
        res.status(500).json({
          error: 'DB_NAME_NOT_RESOLVED',
          message: 'Could not resolve current database name',
        });
        return;
      }

      const tableFilterSql = safeRequestedTables.length
        ? ` AND c.TABLE_NAME IN (${safeRequestedTables
            .map(() => '?')
            .join(',')})`
        : '';
      const tableFilterParams = safeRequestedTables.length
        ? safeRequestedTables
        : [];

      const columns = await select(
        `SELECT
          c.TABLE_NAME,
          c.COLUMN_NAME,
          c.COLUMN_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.COLUMN_KEY,
          c.EXTRA
         FROM information_schema.COLUMNS c
         WHERE c.TABLE_SCHEMA = ?${tableFilterSql}
         ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`,
        [dbName, ...tableFilterParams]
      );

      const foreignKeys = await select(
        `SELECT
          k.TABLE_NAME,
          k.COLUMN_NAME,
          k.REFERENCED_TABLE_NAME,
          k.REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE k
         WHERE k.TABLE_SCHEMA = ?
           AND k.REFERENCED_TABLE_NAME IS NOT NULL${
             safeRequestedTables.length
               ? ` AND k.TABLE_NAME IN (${safeRequestedTables
                   .map(() => '?')
                   .join(',')})`
               : ''
           }
         ORDER BY k.TABLE_NAME, k.COLUMN_NAME`,
        [dbName, ...tableFilterParams]
      );

      res.json({
        database: dbName,
        requestedTables: safeRequestedTables,
        columns,
        foreignKeys,
      });
    } catch (err: any) {
      console.error('[Internal] Schema endpoint error:', err);
      res.status(500).json({
        error: 'SCHEMA_FETCH_FAILED',
        message: err.message,
      });
    }
  });

  if (debugApiEnabled) {
    /**
     * GET /api/internal/table-counts
     *
     * Return exact row counts for all base tables in the current database.
     * This is intended for before/after test comparisons.
     *
     * Query params:
     *   - table?: string | string[] (comma-separated or repeated)
     */
    router.get('/table-counts', async (req, res) => {
      if (!db) {
        res.status(400).json({
          error: 'DB_CONNECTION_REQUIRED',
          message: 'Table counts require a live DB connection',
        });
        return;
      }

      try {
        const { select } = require('../../../lib/db-helper')(db);

        const rawTableQuery = req.query.table;
        const requestedTables = Array.isArray(rawTableQuery)
          ? rawTableQuery
              .flatMap((value) => String(value).split(','))
              .map((value) => value.trim())
              .filter(Boolean)
          : typeof rawTableQuery === 'string'
            ? rawTableQuery
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            : [];

        const safeRequestedTables = requestedTables.filter((table) =>
          /^[a-zA-Z0-9_]+$/.test(table)
        );

        const dbRows = await select('SELECT DATABASE() AS db_name');
        const dbName = dbRows?.[0]?.db_name;
        if (!dbName) {
          res.status(500).json({
            error: 'DB_NAME_NOT_RESOLVED',
            message: 'Could not resolve current database name',
          });
          return;
        }

        const tableFilterSql = safeRequestedTables.length
          ? ` AND TABLE_NAME IN (${safeRequestedTables.map(() => '?').join(',')})`
          : '';
        const tableRows = await select(
          `SELECT TABLE_NAME
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ?
               AND TABLE_TYPE = 'BASE TABLE'${tableFilterSql}
             ORDER BY TABLE_NAME`,
          [dbName, ...safeRequestedTables]
        );

        const counts = [];
        for (const row of tableRows) {
          const tableName = String(row.TABLE_NAME || '');
          if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
            continue;
          }

          const [countRow] = await select(
            `SELECT COUNT(*) AS rowCount FROM \`${tableName}\``
          );

          counts.push({
            table: tableName,
            rowCount: Number(countRow?.rowCount) || 0,
          });
        }

        res.json({
          database: dbName,
          requestedTables: safeRequestedTables,
          capturedAt: new Date().toISOString(),
          tableCount: counts.length,
          totalRows: counts.reduce(
            (sum: number, entry: { rowCount: number }) => sum + entry.rowCount,
            0
          ),
          counts,
        });
      } catch (err: any) {
        console.error('[Internal] Table counts endpoint error:', err);
        res.status(500).json({
          error: 'TABLE_COUNTS_FAILED',
          message: err.message,
        });
      }
    });
  } else {
    console.log(
      '[Internal] Debug routes disabled (set PP_ALLOW_DEBUG_API=1 to enable)'
    );
  }

  /**
   * POST /api/internal/seed
   *
   * Seed the database with test data.
   * Useful for setting up test scenarios.
   *
   * Request Body:
   *   - scenario?: string  - Named scenario to load (default: 'default')
   *   - count?: number     - Number of items to create (default: 10)
   *
   * Response: { seeded: object, message: string }
   */
  router.post('/seed', async (req, res) => {
    if (!useMock) {
      res.status(400).json({
        error: 'MOCK_MODE_REQUIRED',
        message: 'Seeding only available in mock mode',
      });
      return;
    }

    try {
      const scenario = req.body.scenario || 'default';
      const count = req.body.count || 10;

      const seeded: any = {};

      // Example: Seed tournaments
      const tournamentService =
        require('../../services/mocks/tournaments').default();
      seeded.tournaments = [];
      for (let i = 0; i < count; i++) {
        const t = await tournamentService.createTournament('test-user', {
          title: `Test Tournament ${i + 1}`,
          region: 'test',
          date: new Date().toISOString().split('T')[0],
          location: 'Test Location',
        });
        seeded.tournaments.push(t);
      }

      console.log(`[Internal] Seeded ${count} tournaments`);
      res.json({
        seeded,
        message: `Seeded ${count} items with scenario '${scenario}'`,
        scenario,
      });
    } catch (err: any) {
      console.error('[Internal] Seed error:', err);
      res.status(500).json({
        error: 'SEED_FAILED',
        message: err.message,
      });
    }
  });

  return router;
};
