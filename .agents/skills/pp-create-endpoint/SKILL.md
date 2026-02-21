# PP-API Endpoint Creation Guide

This skill provides guidelines for creating new API endpoints in the pp-api codebase following the established 3-layer architecture pattern.

## Quick Start

Use the scaffolding script to generate endpoint boilerplate:

```bash
node scripts/create-endpoint.js <METHOD> <PATH> [options]

# Examples:
node scripts/create-endpoint.js GET api/tournaments/:id/stats
node scripts/create-endpoint.js POST api/venues --auth=required
node scripts/create-endpoint.js PUT api/internal/test/cleanup --internal
```

## Architecture Overview

PP-API uses a strict 3-layer architecture:

```
HTTP Request → Route → Controller → Service → Database
                ↓           ↓           ↓
           URL mapping   Validation   Business logic
           Middleware    Error catch  DB queries
```

### Layer Responsibilities

**Routes** (`src/api/routes/*.ts`)

- Define URL patterns and HTTP methods
- Mount controllers to paths
- Apply middleware (auth, validation)
- No business logic

**Controllers** (`src/api/controllers/*.ts`)

- Extract data from req (params, query, body)
- Validate input (Zod schemas)
- Call services
- Handle responses and errors
- No direct database access

**Services** (`src/api/services/*.ts`)

- Implement business logic
- Execute database queries (via db-helper)
- Handle transactions
- Return data or throw errors
- No HTTP-specific code

### File Organization

```
src/api/
├── routes/
│   └── tournaments.ts          # URL routing only
├── controllers/
│   └── tournaments.ts          # Request handling, validation
├── services/
│   ├── tournaments.ts          # Business logic + DB
│   └── mocks/
│       └── tournaments.ts      # In-memory for testing
└── middleware/
    └── auth.js                 # JWT validation
```

## Creating a New Endpoint

### Step 1: Define the Schema

Document the API contract in the route file using JSDoc:

```typescript
/**
 * POST /api/tournaments/:id/teams
 *
 * Add a team to a tournament
 *
 * @param {string} id - Tournament ID (path)
 * @param {string} teamName - Team name (body)
 * @param {string} category - Age category (body, enum: U8, U10, U12, U14, U16, U18)
 * @returns {object} { data: { id, teamName, category, tournamentId } }
 * @throws {400} Invalid input
 * @throws {401} Unauthorized
 * @throws {404} Tournament not found
 *
 * Database: INSERT INTO teams (name, category, tournament_id) VALUES (?, ?, ?)
 */
```

### Step 2: Create/Update the Route

Routes are factory functions receiving `(db, useMock)`:

```typescript
import express from 'express';
import controllerFactory from '../controllers/myresource';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = controllerFactory(db, useMock);

  // Public endpoints
  router.get('/', ctrl.getAll);
  router.get('/:id', ctrl.getById);

  // Protected endpoints
  const protect = require('../middleware/auth')(db, useMock);
  router.post('/', protect, ctrl.create);
  router.put('/:id', protect, ctrl.update);
  router.delete('/:id', protect, ctrl.delete);

  return router;
};
```

**Important:** Always use `mergeParams: true` for nested resources.

### Step 3: Create/Update the Controller

Controllers handle request/response lifecycle:

```typescript
import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/myresource';
import mockServiceFactory from '../services/mocks/myresource';
import { z } from 'zod';

// Define validation schemas
const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
});

export default (db: any, useMock: boolean) => {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    getAll: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { page = '1', limit = '10' } = req.query;
        const data = await dbSvc.getAll(
          parseInt(page as string, 10),
          parseInt(limit as string, 10)
        );
        res.json({ data });
      } catch (err) {
        next(err);
      }
    },

    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate input
        const result = createSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            details: result.error.flatten(),
          });
          return;
        }

        const created = await dbSvc.create(result.data);
        res.status(201).json({ data: created });
      } catch (err) {
        next(err);
      }
    },

    getById: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        // Validate ID format
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          res.status(400).json({
            error: 'INVALID_ID',
            message: 'ID must be a valid number',
          });
          return;
        }

        const data = await dbSvc.getById(numericId);

        if (!data) {
          res.status(404).json({
            error: 'NOT_FOUND',
            message: `Resource with ID ${id} not found`,
          });
          return;
        }

        res.json({ data });
      } catch (err) {
        next(err);
      }
    },
  };
};
```

**Error Handling Best Practices:**

1. Always use try/catch and call `next(err)`
2. Validate all inputs (path params, query, body)
3. Return 400 for bad input, 404 for missing resources, 500 for server errors
4. Never expose internal errors or stack traces in production
5. Always check if a resource exists before operating on it

### Step 4: Create/Update the Service

Services contain business logic and database access:

```typescript
import dbHelper from '../../lib/db-helper';

export default (db: any) => {
  const { select, insert, update, delete: remove, transaction } = dbHelper(db);

  return {
    getAll: async (page: number, limit: number) => {
      const offset = (page - 1) * limit;
      return await select(
        'SELECT * FROM resources ORDER BY id DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
    },

    getById: async (id: number) => {
      const results = await select('SELECT * FROM resources WHERE id = ?', [
        id,
      ]);
      return results[0] || null;
    },

    create: async (data: { name: string; email: string; age?: number }) => {
      const id = await insert(
        'INSERT INTO resources (name, email, age) VALUES (?, ?, ?)',
        [data.name, data.email, data.age || null]
      );
      return { id, ...data };
    },

    update: async (
      id: number,
      data: Partial<{ name: string; email: string }>
    ) => {
      const affected = await update(
        'UPDATE resources SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
        [data.name, data.email, id]
      );

      if (affected === 0) {
        throw new Error('RESOURCE_NOT_FOUND');
      }

      return await this.getById(id);
    },

    delete: async (id: number) => {
      // Use transaction for related cleanup
      return await transaction(async () => {
        // Delete related records first
        await remove('DELETE FROM resource_tags WHERE resource_id = ?', [id]);

        const affected = await remove('DELETE FROM resources WHERE id = ?', [
          id,
        ]);

        if (affected === 0) {
          throw new Error('RESOURCE_NOT_FOUND');
        }

        return { deleted: true };
      });
    },
  };
};
```

**Service Best Practices:**

1. Always use parameterized queries (db-helper handles this)
2. Use transactions for multi-table operations
3. Return null for single-item lookups when not found
4. Throw errors for business rule violations
5. Keep services stateless

### Step 5: Register the Route

In `src/api/index.js`, add your route:

```javascript
const myResourceRoutes = require('./routes/myresource');

// ... inside module.exports function
app.use('/api/myresources', myResourceRoutes(dbMain, ARGS.useMock));
```

Order matters - more specific routes should come before generic ones.

### Step 6: Create the Mock Service (for testing)

In `src/api/services/mocks/myresource.ts`:

```typescript
let mockData: any[] = [];
let nextId = 1;

export default () => ({
  getAll: async (page: number, limit: number) => {
    const start = (page - 1) * limit;
    return mockData.slice(start, start + limit);
  },

  getById: async (id: number) => {
    return mockData.find((item) => item.id === id) || null;
  },

  create: async (data: any) => {
    const item = { id: nextId++, ...data };
    mockData.push(item);
    return item;
  },

  // For test cleanup
  __reset: () => {
    mockData = [];
    nextId = 1;
  },
});
```

## Authentication Patterns

### Public Endpoints

No auth middleware needed:

```typescript
router.get('/health', ctrl.healthCheck);
router.get('/public-tournaments', ctrl.getPublicTournaments);
```

### Protected Endpoints (Any authenticated user)

```typescript
const protect = require('../middleware/auth')(db, useMock);

router.post('/', protect, ctrl.create);
router.get('/my-profile', protect, ctrl.getMyProfile);
```

### Role-Based Access Control

```typescript
const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Usage:
router.post('/', protect, requireRole(['admin', 'organizer']), ctrl.create);
```

### Resource Ownership

Check ownership in controller or service:

```typescript
// In controller
update: async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // From auth middleware

    const resource = await dbSvc.getById(parseInt(id, 10));

    if (!resource) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (resource.ownerId !== userId && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Not authorized to modify this resource' });
      return;
    }

    const updated = await dbSvc.update(parseInt(id, 10), req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
};
```

## Error Hardening

### Input Validation

Always validate and sanitize inputs:

```typescript
// Path params
const id = parseInt(req.params.id, 10);
if (isNaN(id)) {
  res.status(400).json({ error: 'Invalid ID format' });
  return;
}

// Query params
const limit = parseInt((req.query.limit as string) || '10', 10);
if (isNaN(limit) || limit < 1 || limit > 100) {
  res.status(400).json({ error: 'Invalid limit. Must be between 1 and 100' });
  return;
}

// Body (use Zod)
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});
```

### Database Error Handling

```typescript
// Service level
create: async (data) => {
  try {
    const id = await insert('INSERT INTO ...', [...]);
    return { id, ...data };
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new Error('DUPLICATE_ENTRY: Resource already exists');
    }
    if (err.code === 'ER_NO_REFERENCED_ROW') {
      throw new Error('FOREIGN_KEY_VIOLATION: Referenced resource not found');
    }
    throw err; // Re-throw unknown errors
  }
}

// Controller level
create: async (req, res, next) => {
  try {
    const result = await dbSvc.create(req.body);
    res.status(201).json({ data: result });
  } catch (err: any) {
    if (err.message?.includes('DUPLICATE_ENTRY')) {
      res.status(409).json({ error: 'Resource already exists' });
      return;
    }
    next(err);
  }
}
```

### Preventing Common Issues

```typescript
// 1. Check resource exists before operating
const resource = await dbSvc.getById(id);
if (!resource) {
  res.status(404).json({ error: 'Not found' });
  return;
}

// 2. Validate enum values
const validStatuses = ['active', 'inactive', 'pending'];
if (!validStatuses.includes(req.body.status)) {
  res.status(400).json({
    error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
  });
  return;
}

// 3. Sanitize strings to prevent injection
const sanitized = req.body.name?.replace(/[<>]/g, '');

// 4. Handle null/undefined gracefully
const value = req.body.value ?? defaultValue;
```

## Testing

### Unit Tests (Controllers)

```typescript
// test/unit/api/controllers/myresource.spec.js
const test = require('node:test');
const assert = require('node:assert/strict');
const controllerFactory = require('../../../src/api/controllers/myresource');

test('create returns 201 on success', async () => {
  const controller = controllerFactory({}, true); // useMock = true

  const req = {
    body: { name: 'Test', email: 'test@example.com' },
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) throw err;
  };

  await controller.create(req, res, next);

  assert.equal(res.statusCode, 201);
  assert.ok(res.jsonData?.data?.id);
  assert.equal(res.jsonData.data.name, 'Test');
});

test('create returns 400 on invalid input', async () => {
  const controller = controllerFactory({}, true);

  const req = { body: { email: 'invalid-email' } }; // Missing name
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  const next = (err) => {
    if (err) throw err;
  };

  await controller.create(req, res, next);

  assert.equal(res.statusCode, 400);
  assert.ok(res.jsonData?.error);
});
```

### API Tests

Create YAML test files in `test/api/`:

```yaml
# test/api/3-myresource/1-create.posting.yaml
name: Create resource
method: POST
url: $T_HOST/api/myresources
body:
  content: |-
    {
      "name": "Test Resource",
      "email": "test@example.com"
    }
  content_type: application/json
headers:
  - name: Content-Type
    value: application/json
  - name: Authorization
    value: Bearer $T_TOKEN
```

Run with: `npm run test:api`

## Internal/Test-Only Endpoints

Create endpoints that are only accessible in test/development environments:

```typescript
// src/api/routes/internal.ts
import express from 'express';

export default (db: any, useMock: boolean, isDev: boolean) => {
  const router = express.Router();

  // Only mount in dev/test environments
  if (!isDev) {
    return router;
  }

  router.post('/cleanup', async (req, res) => {
    try {
      // Clear test data
      const { remove } = require('../../lib/db-helper')(db);
      await remove('DELETE FROM test_resources WHERE created_for_test = 1');
      res.json({ message: 'Test data cleaned up' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/reset-mocks', async (req, res) => {
    if (!useMock) {
      res.status(400).json({ error: 'Only available in mock mode' });
      return;
    }

    // Access mock reset functions
    const mocks = require('../services/mocks');
    Object.values(mocks).forEach((mock: any) => {
      if (mock.__reset) mock.__reset();
    });

    res.json({ message: 'Mocks reset' });
  });

  return router;
};
```

Register in `src/api/index.js`:

```javascript
const internalRoutes = require('./routes/internal');

// Only in dev/test
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/internal', internalRoutes(dbMain, ARGS.useMock, true));
}
```

## Documentation Standards

### Route-Level Documentation

Document the API schema in comments above route definitions:

```typescript
/**
 * Tournament Teams Endpoints
 *
 * Base: /api/tournaments/:tournamentId/teams
 *
 * Database Schema:
 *   teams (id, name, category, tournament_id, created_at)
 *   team_players (id, team_id, player_id, position)
 *
 * POST /
 *   Auth: Required (organizer or admin)
 *   Body: { name: string, category: string, players?: number[] }
 *   Response: { data: { id, name, category, tournamentId, players } }
 *   Errors: 400 (validation), 401 (auth), 403 (forbidden), 404 (tournament)
 *
 * GET /
 *   Auth: None (public)
 *   Query: { category?: string, page?: number, limit?: number }
 *   Response: { data: Team[], meta: { total, page, limit } }
 *
 * GET /:id
 *   Auth: None (public)
 *   Response: { data: Team }
 *   Errors: 404
 *
 * PUT /:id
 *   Auth: Required (organizer, admin, or team captain)
 *   Body: { name?: string, players?: number[] }
 *   Response: { data: Team }
 *
 * DELETE /:id
 *   Auth: Required (organizer or admin only)
 *   Response: { message: string }
 */
```

### Type Definitions

Define types for complex objects:

```typescript
interface Team {
  id: number;
  name: string;
  category: 'U8' | 'U10' | 'U12' | 'U14' | 'U16' | 'U18';
  tournamentId: number;
  createdAt: string;
  players?: Player[];
}

interface CreateTeamRequest {
  name: string;
  category: Team['category'];
  players?: number[];
}
```

## Common Patterns

### Pagination

```typescript
// Controller
getAll: async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || '20', 10))
    );

    const { data, total } = await dbSvc.getAll(page, limit);

    res.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Service
getAll: async (page, limit) => {
  const offset = (page - 1) * limit;
  const [data, [{ total }]] = await Promise.all([
    select('SELECT * FROM resources LIMIT ? OFFSET ?', [limit, offset]),
    select('SELECT COUNT(*) as total FROM resources'),
  ]);
  return { data, total };
};
```

### Soft Delete

```typescript
// Don't actually delete, just mark as deleted
service.delete = async (id) => {
  await update('UPDATE resources SET deleted_at = NOW() WHERE id = ?', [id]);
  return { deleted: true };
};

// Update queries to exclude deleted
service.getAll = async () => {
  return await select('SELECT * FROM resources WHERE deleted_at IS NULL', []);
};
```

### Bulk Operations

```typescript
// Controller
bulkCreate: async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array required' });
      return;
    }
    if (items.length > 100) {
      res.status(400).json({ error: 'Maximum 100 items per request' });
      return;
    }

    const results = await dbSvc.bulkCreate(items);
    res.status(201).json({ data: results });
  } catch (err) {
    next(err);
  }
}

// Service (using transaction)
bulkCreate: async (items) => {
  return await transaction(async () => {
    const results = [];
    for (const item of items) {
      const id = await insert('INSERT INTO ...', [...]);
      results.push({ id, ...item });
    }
    return results;
  });
}
```

## Code Generation

Use the scaffolding script to generate boilerplate:

```bash
# Generate all files for a new resource
node scripts/create-endpoint.js GET,POST,PUT,DELETE api/venues

# Generate with authentication
node scripts/create-endpoint.js POST,PUT,DELETE api/admin/reports --auth=admin

# Generate internal test endpoint
node scripts/create-endpoint.js POST api/internal/seed-data --internal

# Skip specific files
node scripts/create-endpoint.js GET api/stats --no-tests
```

This will create:

- `src/api/routes/venues.ts`
- `src/api/controllers/venues.ts`
- `src/api/services/venues.ts`
- `src/api/services/mocks/venues.ts`
- `test/unit/api/controllers/venues.spec.js`
- `test/api/n-venues/1-create.posting.yaml`

## Linting and Type Checking

After creating endpoints, always run:

```bash
npm run lint:fix    # Fix any linting issues
npm run build       # TypeScript compilation check
npm run test:unit   # Run unit tests
```
