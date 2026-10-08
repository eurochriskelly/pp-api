# Competition team allocations

The canonical allocation model reuses `tournament_teams` and `team_entrants`.
`tournament_teams.competitionId` identifies one competition in a tournament.
That competition's `championship_competition_rounds` record supplies its
championship and round; contributors must be registered/active entrants in that
championship. Clubs and amalgamations are both championship entrants.

`team_entrants.numPlayers` records positive whole player counts. The largest
contribution leads. Equal counts are ordered by entrant ID. The cached parent
`entrantId` is updated to the lead in the same transaction. Clearing allocations
sets it to null. Totals are derived from the contribution rows; the legacy
`squadSizeSubmitted` field remains independent team-sheet information. A suffix such as A
or B distinguishes multiple teams from the same entrant. Display names and
percentages are derived, never used as identity. `teamName` remains the fixture
reference, so editing allocations does not break fixtures or historic results.

The older `teams.contributingClubs` JSON belongs to the tournament intake flow;
it is not authoritative for championship allocations. This migration does not
guess entrant identities from slash-delimited fixture labels or invent player
counts. Unallocated teams display an exclamation marker.

## Migration

Apply the existing championship and competition round schema first, then:

```sh
node scripts/migration/competition-team-allocations.js --env=dev
node scripts/migration/competition-team-allocations.js --env=dev --wet
```

Use `--env=acceptance` or `--env=production` for deployment environments.
Production also requires `--confirm-production` for a wet run. The runner takes
an advisory lock and can be rerun. It populates the competition catalogue and
team roster from concrete fixture participants without changing fixture data.
It links existing legacy rows only when their competition is unambiguous;
unscoped legacy rows are retained and reported for review.
Roster reads also provision newly imported concrete fixture participants
idempotently, without overwriting allocations. New competition team creation
should populate `competitionId` explicitly.

## API

- `GET /api/tournaments/:tournamentId/team-allocations` returns competitions,
  round/series details, championship entrants, teams, and derived breakdowns.
- `PUT /api/tournaments/:tournamentId/team-allocations/teams/:teamId` accepts
  `{ "suffix": "A", "allocations": [{ "entrantId": 1, "numPlayers": 8 }] }`.
  Empty allocations clear an assignment; duplicates, zero/fractional counts,
  withdrawn entrants, and entrants from another championship are rejected.
- `PUT /api/tournaments/:tournamentId/team-allocations/competitions/:competitionId/round`
  accepts `{ "championshipId": 1, "roundNumber": 2 }`. Switching championship
  is rejected while any team allocations exist.

Reads are public, as with the existing tournament report. Writes require an
authenticated organizer/admin account or this tournament's organizer code in
`X-Tournament-Organizer-Code`. Client role cookies grant no write permission.
The officials UI keeps a successfully used organizer PIN in tab session storage,
scoped to that tournament; leaving the tournament clears it.
