import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import dbHelper from '../../lib/db-helper';
import authMiddleware from './auth';
import requireRole from './authorization';

// Officials use tournament PINs; account sessions use the existing bearer auth.
// A client-side role cookie is never sufficient to authorize a write.
export default (db: any, useMock: boolean) => {
  const authenticate = authMiddleware(db, useMock);
  const authorize = requireRole(['organizer', 'admin']);
  const failures = new Map<string, number[]>();
  return async (req: Request, res: Response, next: NextFunction) => {
    const pin = req.get('X-Tournament-Organizer-Code');
    if (pin !== undefined) {
      const key = `${req.ip}:${req.params.tournamentId}`;
      const recent = (failures.get(key) || []).filter(
        (time) => time > Date.now() - 15 * 60 * 1000
      );
      if (recent.length >= 10) {
        res
          .status(429)
          .json({
            error: 'Too many incorrect organizer PINs. Please try again later.',
          });
        return;
      }
      try {
        const [row] = useMock
          ? [{ code: 'ORG1' }]
          : await dbHelper(db).select(
              'SELECT code FROM tournaments WHERE id = ?',
              [Number(req.params.tournamentId)]
            );
        const expected = Buffer.from(String(row?.code || '').toUpperCase());
        const actual = Buffer.from(pin.toUpperCase());
        if (
          !expected.length ||
          actual.length !== expected.length ||
          !timingSafeEqual(actual, expected)
        ) {
          failures.set(key, [...recent, Date.now()]);
          res.status(403).json({
            error:
              'Organizer access required. Sign in with this tournament’s organizer PIN.',
          });
          return;
        }
        failures.delete(key);
        next();
      } catch (err) {
        next(err);
      }
      return;
    }
    if (!req.get('Authorization')) {
      res.status(401).json({ error: 'Organizer authentication required' });
      return;
    }
    await authenticate(req, res, () => authorize(req, res, next));
  };
};
