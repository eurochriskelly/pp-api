import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/rulesets';
import mockServiceFactory from '../services/mocks/rulesets';

function rulesetsController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  const parseId = (value: string): number | null => {
    const id = parseInt(value, 10);
    return isNaN(id) ? null : id;
  };

  return {
    listRulesets: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const rows = await dbSvc.listRulesets();
        res.json({ data: rows });
      } catch (err) {
        next(err);
      }
    },

    getRulesetById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseId(req.params.id);
        if (id === null) {
          res.status(400).json({ error: 'Invalid ruleset ID' });
          return;
        }

        const row = await dbSvc.getRulesetById(id);
        if (!row) {
          res.status(404).json({ error: 'Ruleset not found' });
          return;
        }

        res.json({ data: row });
      } catch (err) {
        next(err);
      }
    },

    createRuleset: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { name, config } = req.body;
        if (!name || config === undefined) {
          res.status(400).json({ error: 'name and config are required' });
          return;
        }

        const row = await dbSvc.createRuleset(req.body);
        res.status(201).json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },

    updateRuleset: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseId(req.params.id);
        if (id === null) {
          res.status(400).json({ error: 'Invalid ruleset ID' });
          return;
        }

        const row = await dbSvc.updateRuleset(id, req.body);
        res.json({ data: row });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    },
  };
}

export = rulesetsController;
