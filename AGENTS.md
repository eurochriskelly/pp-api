# Repository Guidelines

## Project Structure & Module Organization
- `src/api/routes`, `src/api/controllers`, and `src/api/services` implement the HTTP surface; keep new endpoints aligned with this flow.
- `src/services/` houses reusable domain logic; prefer composing services over duplicating controller code.
- `docs/api/` contains OpenAPI fragments; regenerate via scripts when changing routes.
- Tests live in `test/unit`; mirror the runtime path (e.g., `test/unit/services/foo.spec.js`).
- Build artifacts land in `dist/`; never edit files there directly.

## Build, Test, and Development Commands
- `npm run build` compiles TypeScript into `dist/`.
- `npm run start` performs a clean build, then runs the compiled server.
- `npm run dev` watches TypeScript and restarts the compiled server via nodemon.
- `npm run lint` / `npm run lint:fix` enforce formatting and lint rules.
- `npm run test:unit` executes the current unit suite with Node's test runner; add specific specs using `node --test path/to/spec.js`.
- `npm run test:api` and `npm run interactive` drive the integration harness; use `make start env=acceptance` to bring up acceptance dependencies when needed.

## Coding Style & Naming Conventions
- Code in TypeScript targeting ES2020, using CommonJS `require`/`module.exports` semantics.
- Follow Prettier defaults: single quotes, trailing commas, and 2-space indentation.
- Use `camelCase` for variables and functions, `PascalCase` for classes/types, and `lower-kebab-case` for filenames.
- Add focused JSDoc on controllers and services when the signature is not obvious; keep files under ~200 lines by extracting helpers into `src/services`.

## Testing Guidelines
- Place unit specs under `test/unit` using `*.spec.js`; structure describe blocks after the module path (e.g., `services/tournaments`).
- Mock external integrations rather than hitting real services; rely on existing fixtures under `test/`.
- Run `npm run test:unit` and, for API surface changes, `npm run test:api` before opening a PR.
- Document uncovered edge cases in the PR if coverage cannot be achieved immediately.

## Commit & Pull Request Guidelines
- Favor short, descriptive commit subjects following the observed `type: detail` pattern (e.g., `refactor: trim stage payload`).
- Squash experimental commits before review; keep history readable by grouping logical changes.
- Pull requests should summarize intent, list relevant commands run, and reference tickets or issues.
- Include screenshots or sample responses for API-affecting work and regenerate API docs (`node scripts/generate-api-docs.js`) when endpoints change.

## Environment & Operations
- Source `pp_env.sh` or use Make targets (`make start-production`, `make mocks`) to load connection details instead of exporting secrets manually.
- Logs rotate under `logs/`; review them when diagnosing local issues and avoid committing them.
- Keep dependencies current; if a new package is required, add pinned versions and run `npm install` before committing `package-lock.json`.
