# pp-api Architecture Hardening Plan

> A resumable, commit-by-commit plan to make pp-api secure, maintainable, and self-documenting.
>
> **Current baseline**: TypeScript migration (`.opencode/plans/`) is complete. The API is already structured as routes → controllers → services and generates OpenAPI from the route tree. The biggest remaining risks are security (unauthenticated mutations), mock/real service drift, stale docs, and test gaps.

## How to resume

1. Open this file (`docs/tasks/architecture-hardening-plan.md`).
2. Find the first unchecked checkbox under **Progress**.
3. Run the **Verify** command for that item before starting it.
4. Do the work, run the verify command again, then commit.
5. Check the box in this file and include the file in the same commit.

If this file is lost or out of date, regenerate it from the previous commit: `git show HEAD:docs/tasks/architecture-hardening-plan.md`.

## Conventions

- One checkbox = one atomic commit.
- Commit messages follow **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- Every commit must pass:
  - `npm run build`
  - `npm run lint`
  - `npm run test:unit` (or the task-specific test)

## Progress

### Phase 0 — Baseline: commit in-flight work

- [x] 0.1 Commit this plan file
  - Files: `docs/tasks/architecture-hardening-plan.md`
  - Verify: `git diff --cached --stat` shows only this file
- [x] 0.2 Fix lint errors (prettier in new tests + unused vars in `scripts/create-endpoint.js`)
  - Files: `scripts/create-endpoint.js`, `test/unit/api/controllers/tournaments-createFixturesWithTournament.spec.js`, `test/unit/api/routes/fixture-contract.spec.js`
  - Verify: `npm run lint`
- [x] 0.3 Commit API-contract feature
  - Files: current uncommitted working tree (capabilities endpoint, fixture import hardening, squad scoping, contract tests, CI workflow)
  - Verify: `npm run build && npm run test:contract`
- [x] 0.4 Baseline verification
  - Verify: `npm run build && npm run lint && npm run test:unit && npm run test:contract`

### Phase 1 — Security foundations (P0)

- [x] 1.1 Env-gate dev auth bypass (`PP_BYPASS_AUTH` / `dev-bypass-token` only when `NODE_ENV !== 'production'`)
  - File: `src/api/middleware/auth.ts`
  - Verify: `npm run test:contract` (auth middleware tests now included)
- [x] 1.2 Fail at boot in production if `JWT_SECRET` is unset
  - File: `src/api/services/auth.ts`
  - Verify: `npm run build`
- [x] 1.3 Make mock-mode DB fallback opt-in instead of silent
  - Files: `src/config.ts`, `src/server.ts`
  - Verify: `npm run build && npm run test:unit`
- [x] 1.4 Add security headers, restrictive CORS, and rate limiting on auth endpoints (implemented inline because npm registry is offline)
  - Files: `src/api/index.ts`, `package.json`
  - Verify: `npm run build && npm run lint`
- [ ] 1.5 Implement `requireRole` middleware
  - File: `src/api/middleware/auth.ts` (or new `src/api/middleware/authorization.ts`)
  - Verify: add unit tests; `npm run test:unit`
- [ ] 1.6 Auth controller unit tests
  - Files: `test/unit/api/controllers/auth.spec.js` (new)
  - Verify: `npm run test:unit`

### Phase 2 — Route auth rollout, domain-by-domain (P0)

For each domain: add `protect` / `requireRole` to mutating routes, update contract tests, note client impact.

- [ ] 2.1 System diagnostics endpoints (`PUT/DELETE /api/system/diagnostics/*`)
  - File: `src/api/routes/system/index.ts`
  - Verify: `npm run test:contract`
- [ ] 2.2 Users domain (`POST/GET /api/users`, `/api/auth/users`)
  - Files: `src/api/routes/users/index.ts`, `src/api/routes/auth/index.ts`
  - Verify: `npm run test:unit` + `npm run test:contract`
- [ ] 2.3 Tournament lifecycle mutations (create/update/delete, reset, generate-fixtures, report)
  - File: `src/api/routes/tournaments/index.ts`
  - Verify: `npm run test:unit` + `npm run test:contract`
- [ ] 2.4 Tournament squads/players/teamsheet/cards/pitches mutations
  - File: `src/api/routes/tournaments/index.ts`
  - Verify: `npm run test:unit` + `npm run test:contract`
- [ ] 2.5 Remaining domains (teams, events, clubs, annual-reports, listings, regions, rulesets, series, championships)
  - Files: corresponding `src/api/routes/*/index.ts`
  - Verify: `npm run test:contract`

### Phase 3 — Mock parity + drift prevention (P1)

- [ ] 3.1 Add parity test: every real service method must exist on its mock
  - File: `test/unit/api/services/mock-parity.spec.js` (new)
  - Verify: `npm run test:unit`
- [ ] 3.2 Bring `mocks/tournaments.ts` to parity
  - File: `src/api/services/mocks/tournaments.ts`
  - Verify: parity test passes
- [ ] 3.3 Bring `mocks/teams.ts` to parity
  - File: `src/api/services/mocks/teams.ts`
  - Verify: parity test passes
- [ ] 3.4 Reconcile `mocks/fixtures.ts` drift
  - File: `src/api/services/mocks/fixtures.ts`
  - Verify: parity test passes
- [ ] 3.5 Verify mock mode serves all advertised capabilities without 500s
  - Verify: `PP_MODE=mock npm run test:contract`

### Phase 4 — Self-documenting API (P1/P2)

- [ ] 4.1 Wire OpenAPI spec regeneration into npm scripts and CI
  - Files: `package.json`, `.github/workflows/contract.yml` (or new `openapi.yml`)
  - Verify: `npm run generate:openapi` produces no diff on `docs/api/openapi.yaml`
- [ ] 4.2 Declare `js-yaml` dependency
  - Files: `package.json`, `package-lock.json`
  - Verify: `rm -rf node_modules && npm ci && npm run generate:openapi`
- [ ] 4.3 Update `docs/architecture-overview.md` to TypeScript reality
  - File: `docs/architecture-overview.md`
  - Verify: docs only; `npm run lint`
- [ ] 4.4 Fix stale references in `AGENTS.md`
  - File: `AGENTS.md`
  - Verify: docs only
- [ ] 4.5 Reconcile redundant/outdated contribution docs
  - Files: `CONTRIB.md`, `contrubution-guide.md`, `GEMINI.md`
  - Verify: docs only
- [ ] 4.6 Complete endpoint schema mapping from existing OpenAPI schemas
  - File: `docs/api/paths/*/*.yaml` (manual mapping per endpoint)
  - Verify: `npm run api` renders docs with typed schemas

### Phase 5 — Test infrastructure (P2)

- [ ] 5.1 Make `test:unit` build first; update AGENTS.md single-test instructions
  - Files: `package.json`, `AGENTS.md`
  - Verify: `npm run test:unit`
- [ ] 5.2 Remove committed compiled artifact `test/unit/headToHead.spec.js`
  - Verify: `npm run test:unit` still passes
- [ ] 5.3 Relabel/document `test:api` vs `task test-api*`
  - Files: `package.json`, `AGENTS.md`, `Makefile`
  - Verify: docs only
- [ ] 5.4 Unit specs for remaining untested controllers
  - Files: `test/unit/api/controllers/{annual-reports,events,general,internal,regions,teams,users}.spec.js`
  - Verify: `npm run test:unit`

### Phase 6 — Hygiene & decomposition (P3, opportunistic)

- [ ] 6.1 Quick wins: 404 typo, dead `middleware/index.ts`, duplicate `/auth` mount, bare `/api` users mount
  - Files: `src/api/index.ts`, `src/api/middleware/index.ts`
  - Verify: `npm run build && npm run test:contract`
- [ ] 6.2 Root clutter cleanup
  - Files: `sync_fixtures_2025-03-24_08:34:12.log`, `test-pdf-parser.js`, `test-mode.sh`, etc.
  - Verify: `npm run build`
- [ ] 6.3 Align `@types/express` version with `express`
  - File: `package.json`
  - Verify: `npm run build`
- [ ] 6.4 Decompose oversized files (only if prior phases done)
  - Files: `src/api/services/tournaments.ts`, `src/api/controllers/tournaments.ts`, `src/api/services/fixtures/validate-tsv.ts`
  - Verify: `npm run test:unit && npm run test:contract`

## Reference

### Old plans

- `.opencode/plans/` — original 8-phase JavaScript-to-TypeScript migration. Status: **complete**. It is git-excluded; do not rely on it.
- `docs/api-refactoring-plan.md` — earlier OpenAPI schema mapping plan. Its work is absorbed into Phase 4.6 of this plan.

### Architecture claims vs reality

- `requireRole` is documented in `AGENTS.md` but does not exist in `src/`. Implement in Phase 1.5.
- Mock parity is documented in `docs/architecture-overview.md` but is not enforced. Enforce in Phase 3.
- OpenAPI generation exists (`scripts/generate-openapi-spec.js`) but has no script or CI wiring. Wire in Phase 4.1.
