import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/users';

function usersController(db: any) {
  const service = serviceFactory(db);

  return {
    createUser: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await service.createUser(req.body);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateUser: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid user ID' });
          return;
        }
        const result = await service.updateUser(id, req.body);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteUser: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid user ID' });
          return;
        }
        const result = await service.deleteUser(id);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    getUser: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid user ID' });
          return;
        }
        const result = await service.getUser(id);
        if (!result) {
          res.status(404).json({ error: 'Not found' });
          return;
        }
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },

    // Roles
    createRole: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await service.createRole(req.body);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateRole: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid role ID' });
          return;
        }
        const result = await service.updateRole(id, req.body);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    deleteRole: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid role ID' });
          return;
        }
        const result = await service.deleteRole(id);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },
  };
}

export = usersController;
