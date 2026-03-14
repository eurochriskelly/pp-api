# PP-API Create Endpoint

Use this skill when adding or updating API endpoints in `pp-api`.

The goal is to keep endpoint work aligned with the code that actually exists in this repo, not a generic Express template.

## What This Repo Actually Looks Like

This codebase uses a 3-layer structure:

`route -> controller -> service`

Key locations:

- `src/api/routes/`
- `src/api/controllers/`
- `src/api/services/`
- `src/api/services/mocks/`
- `src/api/index.ts`
- `test/unit/api/controllers/`
- `test/api/`

Important repo-specific facts:

- Route registration happens in `src/api/index.ts`, not `src/api/index.js`.
- Most route modules live at `src/api/routes/<resource>/index.ts`.
- Some routes are nested, for example:
  - `src/api/routes/tournaments/fixtures/index.ts`
  - `src/api/routes/tournaments/teams/index.ts`
- Controllers usually choose between real and mock services via `useMock`.
- Auth middleware is typically created with `authMiddlewareFactory(db, useMock)`.
- Internal endpoints live in `src/api/routes/internal/index.ts` and are only mounted when `NODE_ENV !== 'production'`.

## Default Workflow

1. Inspect an existing endpoint that looks similar.
2. Decide whether the endpoint belongs in an existing route/controller/service or needs a new module.
3. If a new top-level resource is needed, you may use `node scripts/create-endpoint.js ...` as a starting point.
4. Register new route modules in `src/api/index.ts`.
5. Align controller and service naming with nearby files.
6. Run `npm run lint:fix`, `npm run build`, and the smallest relevant tests.

Do not assume the scaffold output is production-ready. It is a starting point.

## When To Use The Scaffold Script

Script:

```bash
node scripts/create-endpoint.js <METHODS> <PATH> [options]
```

Examples:

```bash
node scripts/create-endpoint.js GET api/venues
node scripts/create-endpoint.js GET,POST,PUT,DELETE api/tournaments/:id/teams
node scripts/create-endpoint.js POST api/reports --auth=required
node scripts/create-endpoint.js POST api/internal/cleanup --internal
```

Options:

- `--auth=none|required|admin`
- `--internal`
- `--no-tests`
- `--no-mock`
- `--dry-run`

Use the script when:

- creating a new top-level resource with conventional CRUD shape
- generating placeholder tests and mock services quickly
- you want a draft to refine manually

Do not rely on the script blindly when:

- adding nested routes under an existing resource tree
- matching a non-CRUD shape already used by nearby endpoints
- the target area already has established naming or mounting conventions

The script currently generates flat files like `src/api/routes/<name>.ts`, while much of this repo uses `src/api/routes/<name>/index.ts`. Normalize the generated output to the local pattern before finishing.

## Route Layer

Routes should:

- define URL patterns and HTTP methods
- create the controller
- attach auth middleware where needed
- avoid business logic

Typical pattern:

```ts
import express from 'express';
import resourceController from '../../controllers/resource';
import authMiddlewareFactory from '../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = resourceController(db, useMock);
  const auth = authMiddlewareFactory(db, useMock);

  router.get('/', ctrl.listResources);
  router.get('/:id', ctrl.getResourceById);

  router.post('/', auth, ctrl.createResource);
  router.put('/:id', auth, ctrl.updateResource);
  router.delete('/:id', auth, ctrl.deleteResource);

  return router;
};
```

Notes:

- Use `mergeParams: true` for nested resources.
- Match the naming used by nearby files. In this repo, controller method names are usually descriptive, not generic `getAll/create/update`.
- For routes needing multiple DB connections, inspect `events` and `listings` first. Those use `dbs`, not just `db`.

## Controller Layer

Controllers should:

- parse params, query, and body
- validate request data
- call the selected service implementation
- translate missing/invalid input into HTTP responses
- pass unexpected failures to `next(err)` unless the surrounding area consistently handles them differently

Typical pattern:

```ts
import { Request, Response, NextFunction } from 'express';
import serviceFactory from '../services/resource';
import mockServiceFactory from '../services/mocks/resource';

function resourceController(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {
    getResourceById: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        const resource = await dbSvc.getResourceById(id);
        if (!resource) {
          res.status(404).json({ error: 'Not found' });
          return;
        }

        res.json({ data: resource });
      } catch (err) {
        next(err);
      }
    },
  };
}

export = resourceController;
```

Validation guidance:

- Reuse local patterns first.
- This repo contains both manual validation and `zod`.
- Do not force `zod` into a file that already follows a simpler manual-validation style unless there is a clear benefit.

Error-handling guidance:

- Prefer `next(err)` for unexpected failures.
- Preserve established behavior in nearby files if they intentionally return `400` for service-thrown validation errors.
- Avoid leaking stack traces or raw internal details in HTTP responses.

## Service Layer

Services should:

- contain business logic
- perform DB operations
- avoid HTTP concerns
- return domain data or throw errors

Use nearby service files as the template for SQL helpers, transaction handling, and return shape. Do not invent a different DB access pattern inside a mature area of the codebase.

If `useMock` is supported for that controller, add the matching mock service under `src/api/services/mocks/`.

## Registration In `src/api/index.ts`

New route modules must be mounted in `src/api/index.ts`.

Examples from the repo:

```ts
app.use('/api/clubs', clubsRoutes(dbMain, ARGS.useMock));
app.use('/api/series', seriesRoutes(dbMain, ARGS.useMock));
app.use(
  '/api/tournaments/:tournamentId/teams',
  tournamentTeamsRoutes(dbMain, ARGS.useMock)
);
```

Checklist:

- add the import near the top
- mount the route at the correct base path
- use `dbMain` or `dbs` consistently with comparable modules
- keep special raw-body routes above the global route mounts if needed

## Internal Endpoints

Internal endpoints are mounted only when:

```ts
process.env.NODE_ENV !== 'production'
```

If adding internal functionality:

- prefer extending `src/api/routes/internal/index.ts`
- keep it explicitly non-production
- be careful with destructive operations
- guard mock-only behavior behind `useMock`

## Testing Expectations

For endpoint work, prefer both:

- unit coverage in `test/unit/api/controllers/`
- API coverage in `test/api/`

Use the nearest existing tests as the template. Match the folder naming convention already present in `test/api/`.

Minimum validation:

```bash
npm run lint:fix
npm run build
npm run test:unit
```

If API behavior changed in a meaningful way, also run:

```bash
npm run test:api
```

If you only need one unit test file:

```bash
node --test test/unit/api/controllers/<file>.spec.js
```

## Practical Rules

- Prefer editing an existing route/controller/service when the endpoint logically belongs there.
- Keep naming consistent with neighboring files.
- Keep files small where practical, but do not force a refactor unless the task calls for it.
- Do not document fake paths or outdated files in generated instructions.
- Do not tell people to register routes in files that do not exist.
- Do not assume auth rules; copy the pattern from the nearest comparable endpoint.
- For nested resources, inspect the existing parent resource tree first.

## Fast Checklist

Before finishing endpoint work:

- route added or updated
- controller added or updated
- service added or updated
- mock service added if `useMock` applies
- route registered in `src/api/index.ts`
- unit tests added or updated
- API tests added or updated when needed
- lint/build/tests run

## References In This Repo

Useful examples:

- `src/api/index.ts`
- `src/api/routes/clubs/index.ts`
- `src/api/routes/tournaments/teams/index.ts`
- `src/api/routes/internal/index.ts`
- `src/api/controllers/clubs.ts`
- `src/api/controllers/tournament-teams.ts`
- `src/api/services/clubs.ts`
- `scripts/create-endpoint.js`
