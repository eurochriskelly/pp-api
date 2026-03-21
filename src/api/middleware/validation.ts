import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/tournaments';
import mockServiceFactory from '../services/mocks/tournaments';

export interface ValidatedRequest extends Request {
  validatedParams?: {
    [key: string]: number | string;
  };
}

/**
 * Validates that a route parameter is a positive integer
 * @param paramName - The name of the parameter to validate
 * @returns Express middleware function
 */
export const validateNumericId = (paramName: string) => {
  return (req: ValidatedRequest, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value) {
      res
        .status(400)
        .json({ error: `Missing required parameter: ${paramName}` });
      return;
    }

    // Check that the value is a valid integer string (no decimals, no extra chars)
    if (!/^\d+$/.test(value)) {
      res.status(400).json({
        error: `Invalid ${paramName}: must be a positive integer`,
      });
      return;
    }

    const numericId = parseInt(value, 10);

    if (numericId <= 0) {
      res.status(400).json({
        error: `Invalid ${paramName}: must be a positive integer`,
      });
      return;
    }

    // Store validated value for use in controllers
    if (!req.validatedParams) {
      req.validatedParams = {};
    }
    req.validatedParams[paramName] = numericId;

    next();
  };
};

/**
 * Validates that a route parameter is a valid UUID
 * @param paramName - The name of the parameter to validate
 * @returns Express middleware function
 */
export const validateUUID = (paramName: string) => {
  return (req: ValidatedRequest, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!value) {
      res
        .status(400)
        .json({ error: `Missing required parameter: ${paramName}` });
      return;
    }

    if (!uuidRegex.test(value)) {
      res.status(400).json({
        error: `Invalid ${paramName}: must be a valid UUID`,
      });
      return;
    }

    if (!req.validatedParams) {
      req.validatedParams = {};
    }
    req.validatedParams[paramName] = value;

    next();
  };
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates a tournament route parameter and resolves UUIDs to the numeric ID.
 * This preserves backward compatibility for handlers and services that still
 * expect the canonical integer tournament ID.
 */
export const validateTournamentIdentifier = (
  db: any,
  useMock: boolean,
  paramName: string = 'tournamentId'
) => {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc: any = factory(db);

  return async (
    req: ValidatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const value = req.params[paramName];

    if (!value) {
      res
        .status(400)
        .json({ error: `Missing required parameter: ${paramName}` });
      return;
    }

    if (/^\d+$/.test(value)) {
      const numericId = parseInt(value, 10);
      if (numericId <= 0) {
        res.status(400).json({
          error: `Invalid ${paramName}: must be a positive integer or UUID`,
        });
        return;
      }

      if (!req.validatedParams) {
        req.validatedParams = {};
      }
      req.validatedParams[paramName] = numericId;
      req.params[paramName] = String(numericId);
      next();
      return;
    }

    if (!UUID_REGEX.test(value)) {
      res.status(400).json({
        error: `Invalid ${paramName}: must be a positive integer or UUID`,
      });
      return;
    }

    try {
      const tournament = await dbSvc.getTournament(undefined, value);
      if (!tournament?.id) {
        res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
        return;
      }

      if (!req.validatedParams) {
        req.validatedParams = {};
      }
      req.validatedParams[paramName] = tournament.id;
      req.validatedParams[`${paramName}Uuid`] = value;
      req.params[paramName] = String(tournament.id);

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Combines multiple validation middlewares
 * @param validators - Array of validation middleware functions
 * @returns Express middleware function that runs all validators
 */
export const validateMultiple = (
  ...validators: Array<
    (req: ValidatedRequest, res: Response, next: NextFunction) => void
  >
) => {
  return (req: ValidatedRequest, res: Response, next: NextFunction): void => {
    let index = 0;

    const runNext = () => {
      if (index >= validators.length) {
        next();
        return;
      }

      const validator = validators[index++];
      validator(req, res, (err?: any) => {
        if (err) {
          next(err);
          return;
        }
        runNext();
      });
    };

    runNext();
  };
};
