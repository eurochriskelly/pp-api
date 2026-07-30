import dbHelper = require('../../lib/db-helper');

const MOCK_MODULES = [
  '../../services/mocks/tournaments',
  '../../services/mocks/listings',
  '../../services/mocks/fixtures',
  '../../services/mocks/auth',
];

function internalService(db: any, useMock: boolean) {
  const { select, delete: remove } = dbHelper(db);

  return {
    cleanup: async (
      tables: string[] = ['test_resources', 'temp_data'],
      keepUsers = true
    ): Promise<{ cleaned: string[]; keepUsers: boolean; message: string }> => {
      const cleaned: string[] = [];

      for (const table of tables) {
        try {
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

      return {
        cleaned,
        keepUsers,
        message: `Cleaned ${cleaned.length} tables`,
      };
    },

    resetMocks: async (): Promise<{ reset: string[]; message: string }> => {
      if (!useMock) {
        const error: any = new Error(
          'Mock reset only available when useMock=true'
        );
        error.code = 'MOCK_MODE_REQUIRED';
        throw error;
      }

      const reset: string[] = [];

      for (const modulePath of MOCK_MODULES) {
        try {
          const mockModule = require(modulePath);
          const mockFactory = mockModule.default || mockModule;
          const mock = mockFactory();

          if (mock.__reset) {
            mock.__reset();
            reset.push(modulePath.split('/').pop() as string);
          }
        } catch (err) {
          // Module might not exist, skip
        }
      }

      console.log('[Internal] Reset mocks:', reset);
      return {
        reset,
        message: `Reset ${reset.length} mock services`,
      };
    },

    healthCheck: async (): Promise<any> => {
      const startTime = Date.now();
      const [dbCheck] = await select('SELECT 1 as check_val');
      const dbLatency = Date.now() - startTime;

      return {
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
    },

    schema: async (rawTables?: string | string[]): Promise<any> => {
      if (!db) {
        const error: any = new Error(
          'Schema inspection requires a live DB connection'
        );
        error.code = 'DB_CONNECTION_REQUIRED';
        throw error;
      }

      const requestedTables = normalizeTableQuery(rawTables);
      const safeRequestedTables = requestedTables.filter((table) =>
        /^[a-zA-Z0-9_]+$/.test(table)
      );

      const dbRows = await select('SELECT DATABASE() AS db_name');
      const dbName = dbRows?.[0]?.db_name;
      if (!dbName) {
        const error: any = new Error('Could not resolve current database name');
        error.code = 'DB_NAME_NOT_RESOLVED';
        throw error;
      }

      const tableFilterSql = safeRequestedTables.length
        ? ` AND c.TABLE_NAME IN (${safeRequestedTables.map(() => '?').join(',')})`
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

      const fkFilterSql = safeRequestedTables.length
        ? ` AND k.TABLE_NAME IN (${safeRequestedTables.map(() => '?').join(',')})`
        : '';
      const foreignKeys = await select(
        `SELECT
          k.TABLE_NAME,
          k.COLUMN_NAME,
          k.REFERENCED_TABLE_NAME,
          k.REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE k
         WHERE k.TABLE_SCHEMA = ?
           AND k.REFERENCED_TABLE_NAME IS NOT NULL${fkFilterSql}
         ORDER BY k.TABLE_NAME, k.COLUMN_NAME`,
        [dbName, ...tableFilterParams]
      );

      return {
        database: dbName,
        requestedTables: safeRequestedTables,
        columns,
        foreignKeys,
      };
    },

    tableCounts: async (rawTables?: string | string[]): Promise<any> => {
      if (!db) {
        const error: any = new Error(
          'Table counts require a live DB connection'
        );
        error.code = 'DB_CONNECTION_REQUIRED';
        throw error;
      }

      const requestedTables = normalizeTableQuery(rawTables);
      const safeRequestedTables = requestedTables.filter((table) =>
        /^[a-zA-Z0-9_]+$/.test(table)
      );

      const dbRows = await select('SELECT DATABASE() AS db_name');
      const dbName = dbRows?.[0]?.db_name;
      if (!dbName) {
        const error: any = new Error('Could not resolve current database name');
        error.code = 'DB_NAME_NOT_RESOLVED';
        throw error;
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

      const counts: Array<{ table: string; rowCount: number }> = [];
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

      return {
        database: dbName,
        requestedTables: safeRequestedTables,
        capturedAt: new Date().toISOString(),
        tableCount: counts.length,
        totalRows: counts.reduce(
          (sum: number, entry: { rowCount: number }) => sum + entry.rowCount,
          0
        ),
        counts,
      };
    },

    seed: async (scenario: string, count: number): Promise<any> => {
      if (!useMock) {
        const error: any = new Error('Seeding only available in mock mode');
        error.code = 'MOCK_MODE_REQUIRED';
        throw error;
      }

      const seeded: any = {};
      const tournamentService =
        require('../services/mocks/tournaments').default();
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
      return {
        seeded,
        message: `Seeded ${count} items with scenario '${scenario}'`,
        scenario,
      };
    },
  };
}

function normalizeTableQuery(raw?: string | string[]): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

export = internalService;
