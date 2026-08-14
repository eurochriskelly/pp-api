# Agent Guidelines for pp-api

## Build/Lint/Test Commands

- **Build**: `npm run build` (rm -rf dist && tsc)
- **Start**: `npm run start` (build + node dist/src/server.js)
- **Dev**: `npm run dev` (tsx watch src/server.ts)
- **Lint**: `npm run lint` / `npm run lint:fix` (eslint .)
- **Unit tests**: `npm run test:unit` (runs compiled specs under `dist/test/unit/`)
- **Contract tests**: `npm run test:contract` / `npm run verify:contract`
- **Single test**: `node --test dist/test/unit/path/filename.spec.js`
- **API tests**: `npm run test:api`
- **OpenAPI spec**: `npm run generate:openapi`
- **Interactive**: `npm run interactive`

## Code Style Guidelines

- **Language**: TypeScript (ES2020, CommonJS) - the entire `src/` folder is TypeScript
- **Formatting**: Prettier (singleQuote: true, trailingComma: 'es5', 2-space indent)
- **Naming**: camelCase vars/functions, PascalCase types, kebab-case files
- **Imports**: CommonJS require() in JS/TS (tsconfig module: commonjs)
- **Error handling**: try/catch with `res.status(500).json({ error: err.message })`
- **Async**: async/await consistently
- **ESLint**: Flat config, globals.node, prettier integration
- **File size**: &lt;200 lines; extract to services/
- **Architecture**: routes → controllers → services

## Creating New Endpoints

Use the scaffolding script to generate endpoint boilerplate:

```bash
# Basic usage
node scripts/create-endpoint.js <METHODS> <PATH>

# Examples
node scripts/create-endpoint.js GET api/venues
node scripts/create-endpoint.js GET,POST,PUT,DELETE api/tournaments/:id/teams
node scripts/create-endpoint.js POST api/reports --auth=required
node scripts/create-endpoint.js POST api/internal/cleanup --internal
```

**Script options:**

- `--auth=<mode>` - Auth mode: none, required, admin (default: none)
- `--internal` - Mark as internal/test endpoint
- `--no-tests` - Skip generating test files
- `--no-mock` - Skip generating mock service
- `--dry-run` - Preview without creating files

The script generates:

- Route file (`src/api/routes/`)
- Controller file (`src/api/controllers/`)
- Service file (`src/api/services/`)
- Mock service (`src/api/services/mocks/`)
- Unit tests (`test/unit/api/controllers/`)
- API tests (`test/api/`)

**After generating:**

1. Register the route in `src/api/index.ts`
2. Update validation schemas in the controller
3. Update database table names in the service
4. Run `npm run lint:fix && npm run build`
5. Run tests: `npm run test:unit` and `npm run test:contract`

## Architecture Reference

For detailed endpoint creation guidelines, see:
**`.agents/skills/pp-create-endpoint/SKILL.md`**

This covers:

- 3-layer architecture (routes → controllers → services)
- Authentication patterns (public, protected, role-based)
- Error hardening and validation
- Database patterns (transactions, soft delete, pagination)
- Testing requirements (unit + API tests)
- Internal/test-only endpoints
- Common code patterns

## Key Patterns

### Authentication

```javascript
const protect = require('../middleware/auth')(db, useMock);

// Public
router.get('/', ctrl.getAll);

// Protected
router.post('/', protect, ctrl.create);

// Role-based
router.delete('/', protect, requireRole(['admin']), ctrl.delete);
```

### Error Handling

```typescript
try {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }

  const data = await dbSvc.getById(id);
  if (!data) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  res.json({ data });
} catch (err) {
  next(err); // Pass to global error handler
}
```

### Internal/Test Endpoints

Internal endpoints are only available in non-production environments:

```bash
# Available when NODE_ENV !== 'production'
POST /api/internal/cleanup      # Clean test data
POST /api/internal/reset-mocks  # Reset mock services
GET  /api/internal/health       # Detailed health check
POST /api/internal/seed         # Seed test data
```

See `src/api/routes/internal/` for implementation.

No .cursor/rules or .github/copilot-instructions.md found.
