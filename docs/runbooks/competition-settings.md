# Tournament competition settings

`POST /api/tournaments` and `PUT /api/tournaments/:id` accept `competitionSettings`, an array of objects with `category`, `winPoints`, `drawPoints`, `losePoints`, and `verifyGroupStages`. Categories must be unique (case insensitive), points must be finite nonnegative numbers, and verification must be boolean. The array replaces the saved settings; omitted settings are preserved. Explicit zeroes are valid.

Tournament edits also accept `endDate` (date or null), `codeReferee`, and `codeTeam`, alongside existing details and codes. End dates cannot precede the start date. GET returns normalized date/details aliases and the competition settings. Status changes continue to use the existing status endpoint.

Standings SQL, reports, head-to-head ties, predictions, and calculated knockout assignments use the category rules. Categories without explicit settings fall back to the legacy tournament columns. Legacy top-level scoring updates apply to all saved competition settings for compatibility. Changed scoring/settings clear the affected categories' group verification and refresh calculated fixtures atomically; matches already started are not reassigned. Report cache is refreshed after an edit.

Authenticated clients can search organizer names with `GET /api/users?filter=joh` (at least two characters); responses contain only `userId` and `name`, limited to 50 results. Unfiltered user listing remains admin-only. Organizer lists deduplicate existing role rows, and repeated assignment is serialized per tournament and does not add another role.

## Migration

Requires MySQL 8 (JSON_TABLE is used in standings queries). Run the migration before starting the updated API:

```sh
node scripts/migration/migrate-competition-settings.js --env=dev
node scripts/migration/migrate-competition-settings.js --env=dev --wet
```

The development migration was applied during implementation. Other environments must be migrated separately. Production application requires `--env=production --wet --confirm-production`.

The runner adds the JSON column and any missing group verification columns. It discovers categories from fixtures, tournament competitions, squads, and teams, then copies each tournament's existing scoring/verification values to every discovered category. It only backfills NULL settings and can be rerun without overwriting edits. Tournaments without categories receive an empty array and continue to use legacy defaults. Legacy columns remain in place; no tournament or fixture rows are deleted.

Before backfill, the runner saves a scoring snapshot under the ignored `backups/` directory. Backfill is transactional; MySQL schema additions are not. Stop application writes during migration and take the normal full database backup before deployment. Restore the scoring snapshot or database backup if rollback is needed; retain the additive columns while running this API version.
