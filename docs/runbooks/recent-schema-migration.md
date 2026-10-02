# Recent schema migration runbook

Use `scripts/migration/apply-recent-schema.js` for the invite-registration,
championship-competition-round, and fixture-outcome migrations. Do not run the
individual SQL files directly: they document the intended schema but do not
provide the runner's preflight checks, advisory lock, or rerun protection.

## Acceptance

1. Restore a recent production backup to the acceptance database.
2. Run `npm run migrate:recent-schema -- --env=acceptance` to perform a
   read-only prerequisite check.
3. Take an acceptance backup, then run
   `npm run migrate:recent-schema -- --env=acceptance --wet`.
4. Run `npm run build && npm run test:unit && npm run test:contract` and smoke
   test invite registration, tournament competitions, championship rounds, and
   fixture scoring.
5. Run the dry-run again. It must succeed, confirming the schema is rerunnable.

## Production

Schedule a maintenance window: the fixture-outcome phase changes an enum on the
whole `fixtures` table twice and may hold a metadata lock or rebuild the table.

1. Confirm acceptance completed successfully and deploy the API only after its
   schema migration is complete.
2. Take and validate a fresh backup with `task db:backup ENV=production`.
3. Run `npm run migrate:recent-schema -- --env=production` for a read-only
   preflight.
4. During the window, run
   `npm run migrate:recent-schema -- --env=production --wet --confirm-production`.
5. Verify `schema_migrations` contains the three `20261002_*` records, no
   fixture outcome is `NULL`, `conceded`, or `forfeit`, and the API health check
   and the affected flows succeed.

If any step fails, leave the API on its prior release, resolve the reported
preflight problem, and rerun the same command. The runner checks every schema
operation before applying it and its data updates are idempotent. Restore the
backup only if the migration made a material, incorrect data transformation.
