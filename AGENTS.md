# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/`; `src/server.js` boots Express and delegates to domain modules under `src/api/` (`controllers/`, `routes/`, `services/`). Shared helpers reside in `src/lib/`. Keep generated JavaScript in `dist/` untouched. Docs sit under `docs/`, scripts in `scripts/`, and any manual logs or fixtures in `logs/`. Follow relative imports from `src/` and group exports by feature area.

## Build, Test, and Development Commands
Run `npm run build` to clean TypeScript output and emit into `dist/`. Use `npm run start` for a production-like launch, or `npm run dev` to watch sources with Nodemon reloads. Operational helpers are exposed via Make targets: `make start env=acceptance` mirrors the acceptance stack, `make mocks` spins up the mock API, and `make logs` tails the latest environment log. Create database backups through `npm run backup`.

## Coding Style & Naming Conventions
We target CommonJS with TypeScript tooling. Adhere to ESLint + Prettier via `npm run lint`, which enforces two-space indentation, single quotes, and trailing commas where valid. Name files in lower-kebab-case (e.g., `user-service.ts`) and functions/variables in camelCase. Place new code inside `src/` and keep module boundaries clear.

## Testing Guidelines
Integration specs live in `test/` and follow `<feature>.spec.js`. Pure business logic belongs in unit specs under `test/unit/`; run them with `npm run test:unit` and extend coverage whenever you add or change helpers. Run hosted API checks with `npm run test:api`, and use `npm run interactive` for the CLI acceptance harness. Update `sync_fixtures_*` assets whenever service behavior changes. Ensure new work has coverage that matches the affected area before opening a PR.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`). Provide focused subjects, optional bodies for rollback context, and link issues when relevant. Pull requests should summarize user-facing changes, include related ticket links, attach test evidence (command output or screenshots), and flag environment updates. Wait for CI and lint to pass before requesting review.

## Security & Configuration Tips
Keep `pp_env.sh` synchronized with any new variables. Avoid committing secrets or local config overrides. When adding new service integrations, document required environment variables in `docs/` and provide safe defaults in sample configs.
