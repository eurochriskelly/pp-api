# Calculated fixtures

Apply `scripts/migration/add-group-stage-verification.sql` before deploying this change. It adds `verifyGroupStages` (default `false`) and the stored approval hashes. Existing tournaments retain automatic resolution.

Scores and fixture completion refresh calculated assignments in the same database transaction. Only `team1Id`, `team2Id`, and `umpireTeamId` change. Their corresponding `*Planned` references remain intact. Started, ended, played, and skipped knockout fixtures are protected.

Before the group finishes, a team is assigned only if points bounds prove its exact position. A completed two-team head-to-head can resolve equal point bounds when no third team can join that tie. Unbounded future score differences never justify predictions. Uncertain assignments display `PENDING`; a genuinely tied final position displays `CONTESTED`.

## Manual refresh

Authenticated `POST /api/tournaments/:tournamentId/calculated-fixtures/refresh` accepts:

```json
{ "category": "CAMOGIE", "mode": "resolve" }
```

`category` is optional; omission refreshes every category. `mode` defaults to `resolve`. `pending` or `contested` places that marker in every editable calculated team and umpire slot. Static team assignments are retained. The response lists changed fields and skipped fixture IDs.

Set `verifyGroupStages: true` when creating or updating a tournament to require group-result approval. Completed group references stay `PENDING` until the explicit `resolve` refresh approves the category's completed results. Approval persists across automatic updates; changing group results or the points rules invalidates it. If any category group remains unfinished, refresh does not approve the category yet. Match references from completed knockout results continue to resolve normally.

Changing the verification setting immediately refreshes editable assignments. Enabling it invalidates previous approvals; disabling it resolves the current group standings. Updating the tournament's points rules also recalculates the fixtures.

The existing authenticated `PUT /api/tournaments/:tournamentId/fixtures/update-calculated-fixtures` remains supported and calls the same resolver, approving completed groups. Its fixture-specific counterpart scopes the refresh to that fixture's category.

This is a source-code change. It does not deploy the API, migrate production, or change live tournament fixtures by itself.
