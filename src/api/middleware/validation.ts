import { Request, Response, NextFunction } from 'express';

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
