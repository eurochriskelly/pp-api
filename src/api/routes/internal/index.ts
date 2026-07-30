import express from 'express';
import internalController from '../../controllers/internal';

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
export default (dbs: any, useMock: boolean, isDev: boolean) => {
  const router = express.Router();
  const debugApiEnabled = process.env.PP_ALLOW_DEBUG_API === '1';

  // Only mount in dev/test environments
  if (!isDev) {
    console.log('[Internal] Routes disabled in production');
    return router;
  }

  console.log('[Internal] Routes enabled for testing');

  const dbMain = dbs.main || dbs;
  const ctrl = internalController(dbMain, useMock);

  router.post('/cleanup', ctrl.cleanup);
  router.post('/reset-mocks', ctrl.resetMocks);
  router.get('/health', ctrl.healthCheck);

  if (debugApiEnabled) {
    router.get('/schema', ctrl.schema);
    router.get('/table-counts', ctrl.tableCounts);
  } else {
    console.log(
      '[Internal] Debug routes disabled (set PP_ALLOW_DEBUG_API=1 to enable)'
    );
  }

  router.post('/seed', ctrl.seed);

  return router;
};
