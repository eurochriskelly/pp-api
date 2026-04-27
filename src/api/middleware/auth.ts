import { Request, Response, NextFunction } from 'express';
import authServiceFactory from '../services/auth';
import authMockServiceFactory from '../services/mocks/auth';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    username?: string;
  };
}

function authMiddleware(db: any, useMock: boolean) {
  const factory = useMock ? authMockServiceFactory : authServiceFactory;
  const authService = factory(db);

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7, authHeader.length);

      // Dev bypass: allow "dev-bypass-token" when PP_BYPASS_AUTH=1
      if (process.env.PP_BYPASS_AUTH === '1' && token === 'dev-bypass-token') {
        const bypassEmail = process.env.PP_EMAIL;
        if (bypassEmail) {
          req.user = {
            id: 'dev-bypass',
            email: bypassEmail,
            role: process.env.PP_BYPASS_ROLE || 'player',
            username: bypassEmail,
          };
          return next();
        }
      }

      try {
        const user = await authService.verifyToken(token);
        req.user = user;
        next();
      } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
      }
    } else {
      res.status(401).json({ error: 'Authorization token required' });
    }
  };
}

export = authMiddleware;
