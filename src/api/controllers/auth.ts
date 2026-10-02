import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/auth';
import mockServiceFactory from '../services/mocks/auth';

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

function authController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    /**
     * Create a new user account
     */
    signup: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { email } = req.body;
      try {
        if (!email) {
          res.status(400).json({ error: 'Email is required' });
          return;
        }
        const result = await dbSvc.signup(email);
        res.status(200).json(result);
      } catch (err) {
        if ((err as Error).message === 'User not found') {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        res.status(400).json({ error: (err as Error).message });
      }
    },

    /**
     * Authenticate a user and return a token
     */
    login: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { email, password } = req.body;
      try {
        if (!email || !password) {
          res.status(400).json({ error: 'Email and password are required' });
          return;
        }
        const result = await dbSvc.login(email, password);
        res.json(result);
      } catch (err) {
        res.status(401).json({ error: (err as Error).message });
      }
    },

    createInvite: async (req: Request, res: Response): Promise<void> => {
      try {
        const { phone } = req.body;
        if (!phone) {
          res.status(400).json({ error: 'Phone is required' });
          return;
        }
        const result = await (dbSvc as any).createInvite(phone);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    getInviteStatus: async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await (dbSvc as any).getInviteStatus(req.params.token);
        res.json(result);
      } catch (err) {
        const message = (err as Error).message;
        res.status(message === 'Invite not found' ? 404 : 400).json({ error: message });
      }
    },

    registerFromInvite: async (req: Request, res: Response): Promise<void> => {
      try {
        const { name, password, code, clubId, clubName } = req.body;
        if (!name || !password || (!clubId && !clubName)) {
          res.status(400).json({ error: 'Name, password and club are required' });
          return;
        }
        const result = await (dbSvc as any).registerFromInvite(
          req.params.token,
          name,
          password,
          code,
          clubId ? Number(clubId) : undefined,
          clubName
        );
        res.status(201).json(result);
      } catch (err) {
        const message = (err as Error).message;
        res.status(message.includes('expired') ? 410 : 400).json({ error: message });
      }
    },

    loginWithCode: async (req: Request, res: Response): Promise<void> => {
      try {
        const { phone, code } = req.body;
        if (!phone || !code) {
          res.status(400).json({ error: 'Phone and code are required' });
          return;
        }
        const result = await (dbSvc as any).loginWithCode(phone, code);
        res.json(result);
      } catch (err) {
        res.status(401).json({ error: (err as Error).message });
      }
    },

    /**
     * Logout a user by invalidating their token
     */
    logout: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const authHeader = req.headers.authorization;
      let token: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7, authHeader.length);
      } else {
        token = req.body.token;
      }

      try {
        const result = await dbSvc.logout(token);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get current authenticated user information
     */
    getCurrentUser: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7, authHeader.length);
        try {
          const user = await dbSvc.verifyToken(token);
          res.json(user);
        } catch {
          res.status(401).json({ error: 'Invalid or expired token' });
        }
      } else {
        res.status(401).json({ error: 'Authorization token required' });
      }
    },

    verify: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { email, code } = req.body;
      try {
        if (!email || !code) {
          res.status(400).json({ error: 'Email and code are required' });
          return;
        }
        const result = await dbSvc.verify(email, code);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    register: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { email, name, club } = req.body;
      try {
        if (!email || !name) {
          res.status(400).json({ error: 'Email and name are required' });
          return;
        }
        // Type assertion to handle both real and mock services
        const result = await (dbSvc as any).register(email, name, club);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    getUsers: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { filter } = req.query;
      try {
        // Type assertion to handle both real and mock services
        const users = await (dbSvc as any).getUsers(filter);
        res.json({ data: users });
      } catch (err) {
        next(err);
      }
    },

    checkEmail: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { email } = req.body;
      try {
        if (!email) {
          res.status(400).json({ error: 'Email is required' });
          return;
        }
        const user = await dbSvc.checkEmail(email);
        if (user) {
          res.status(200).json({ exists: true });
        } else {
          res.status(404).json({ exists: false });
        }
      } catch (err) {
        next(err);
      }
    },
  };
}

export = authController;
