import mysql from 'mysql2';
import { EE } from './logging';

const DB_UNAVAILABLE_MSG =
  'Database connection is not available. Please check your database configuration and ensure the database is running.';
const RECONNECT_THROTTLE_MS = 5000;

function isConnectionError(err: any): boolean {
  if (!err) return false;
  const code = err.code;
  const msg = err.message || String(err);
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ER_CON_COUNT_ERROR' ||
    msg.includes('Connection lost') ||
    msg.includes("Can't connect") ||
    msg.includes('connect ECONNREFUSED') ||
    msg.includes('connect ETIMEDOUT') ||
    msg.includes('Connection was closed')
  );
}

function createDbManager(dbConf: any) {
  let pool: mysql.Pool | null = null;
  let creatingPool: Promise<mysql.Pool> | null = null;
  let lastFailureTime = 0;

  const createPool = (): mysql.Pool => {
    const newPool = mysql.createPool(dbConf);
    newPool.on('connection', (connection) => {
      connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    });
    return newPool;
  };

  const getPool = async (): Promise<mysql.Pool | null> => {
    if (pool) return pool;
    if (creatingPool) return creatingPool;

    const now = Date.now();
    if (now - lastFailureTime < RECONNECT_THROTTLE_MS) {
      return null;
    }

    creatingPool = new Promise<mysql.Pool>((resolve, reject) => {
      try {
        const newPool = createPool();
        newPool.query('SELECT 1', [], (err) => {
          if (err) {
            lastFailureTime = Date.now();
            try {
              newPool.end(() => {});
            } catch (_) {}
            reject(err);
          } else {
            pool = newPool;
            resolve(newPool);
          }
        });
      } catch (err) {
        lastFailureTime = Date.now();
        reject(err);
      }
    }).finally(() => {
      creatingPool = null;
    });

    return creatingPool;
  };

  const handleConnectionError = (err: any): Error => {
    if (isConnectionError(err)) {
      EE(`Database connection lost: ${err.message || String(err)}`);
      if (pool) {
        try {
          pool.end(() => {});
        } catch (_) {}
        pool = null;
      }
      lastFailureTime = Date.now();
      return new Error(DB_UNAVAILABLE_MSG);
    }
    return err instanceof Error ? err : new Error(String(err));
  };

  const query = (
    sql: string,
    valuesOrCallback: unknown[] | ((err: Error | null, results: any) => void),
    optionalCallback?: (err: Error | null, results: any) => void
  ): void => {
    let values: unknown[] = [];
    let callback: (err: Error | null, results: any) => void;

    if (typeof valuesOrCallback === 'function') {
      callback = valuesOrCallback;
    } else {
      values = (valuesOrCallback as unknown[]) || [];
      callback = optionalCallback as (err: Error | null, results: any) => void;
    }

    if (typeof callback !== 'function') {
      throw new TypeError('dbManager.query requires a callback function');
    }

    getPool()
      .then((activePool) => {
        if (!activePool) {
          return callback(new Error(DB_UNAVAILABLE_MSG), null as any);
        }
        activePool.query(sql, values, (err, results) => {
          if (err) {
            return callback(handleConnectionError(err), null as any);
          }
          callback(null, results);
        });
      })
      .catch((err) => {
        callback(handleConnectionError(err), null as any);
      });
  };

  const getConnection = (
    callback: (err: Error | null, connection: any) => void
  ): void => {
    if (typeof callback !== 'function') {
      throw new TypeError(
        'dbManager.getConnection requires a callback function'
      );
    }
    getPool()
      .then((activePool) => {
        if (!activePool) {
          return callback(new Error(DB_UNAVAILABLE_MSG), null);
        }
        activePool.getConnection((err, connection) => {
          if (err) {
            return callback(handleConnectionError(err), null);
          }
          callback(null, connection);
        });
      })
      .catch((err) => {
        callback(handleConnectionError(err), null);
      });
  };

  return { query, getConnection };
}

export = createDbManager;
