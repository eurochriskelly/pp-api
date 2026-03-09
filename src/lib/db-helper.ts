import { DD, EE } from './logging';
import * as systemService from '../api/services/system';

interface QueryResult {
  [key: string]: unknown;
  insertId?: number;
  affectedRows?: number;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: QueryResult[] | QueryResult) => void
  ) => void;
}

interface DbHelper {
  select: (query: string, params?: unknown[]) => Promise<QueryResult[]>;
  insert: (query: string, params?: unknown[]) => Promise<number>;
  update: (query: string, params?: unknown[]) => Promise<number>;
  delete: (query: string, params?: unknown[]) => Promise<number>;
  transaction: <T>(operations: () => Promise<T>) => Promise<T>;
}

function dbHelper(db: DbConnection): DbHelper {
  const execute = (
    type: string,
    query: string,
    params: unknown[] = []
  ): Promise<QueryResult[]> => {
    return new Promise((resolve, reject) => {
      if (systemService.getPrintSqlStatements()) {
        DD(`Executing [${type}]`);
        DD(`- query: ${query.split('\n').join(' ').replace(/ /g, ' ')}`);
        DD(`- params: ${JSON.stringify(params)}`);
      }
      db.query(query, params, (err, results) => {
        if (err) {
          EE(`Query failed: ${err.message}`);
          return reject(err);
        }
        if (results === undefined) {
          EE('Error: db.query returned undefined results.');
          resolve([]);
        } else {
          resolve(Array.isArray(results) ? results : [results]);
        }
      });
    });
  };

  return {
    // Basic CRUD operations
    select: (query: string, params?: unknown[]) =>
      execute('select', query, params),
    insert: (query: string, params?: unknown[]) =>
      execute('insert', query, params).then(
        (r) => (r[0]?.insertId as number) || 0
      ),
    update: (query: string, params?: unknown[]) =>
      execute('update', query, params).then(
        (r) => (r[0]?.affectedRows as number) || 0
      ),
    delete: (query: string, params?: unknown[]) =>
      execute('delete', query, params).then(
        (r) => (r[0]?.affectedRows as number) || 0
      ),

    // Helper for transactions
    transaction: async <T>(operations: () => Promise<T>): Promise<T> => {
      try {
        await execute('tx', 'START TRANSACTION');
        const result = await operations();
        await execute('tx', 'COMMIT');
        return result;
      } catch (err) {
        await execute('tx', 'ROLLBACK');
        throw err;
      }
    },
  };
}

export = dbHelper;
