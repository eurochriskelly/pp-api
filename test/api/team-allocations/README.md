# Allocation API story

`test/unit/team-allocations.spec.ts` covers HTTP authorization and validation.
`PP_ALLOCATION_DB_TEST=1 node --test dist/test/unit/team-allocations-db.spec.js`
also tests persistence against the configured development database, creating
and cleaning its own tournament, series, championships, teams, and entrants.

The posting story runs against a dedicated disposable tournament that has one
competition, one linked championship round, one roster team, and three entrants.
It writes player counts 8/5/2; do not point it at actual event allocations.

Set `BASE_URL`, `ALLOCATION_TOURNAMENT_ID`, `ALLOCATION_TEAM_ID`,
`ALLOCATION_ENTRANT_1`, `ALLOCATION_ENTRANT_2`, `ALLOCATION_ENTRANT_3`,
`ALLOCATION_ORGANIZER_CODE`, and `ALLOCATION_COORDINATOR_CODE`, then run:

```sh
SUITE=suites/team-allocations.txt npm run test:api
```

Use the fixture owner’s cleanup procedure afterward. The story never creates
or deletes clubs/championships on its own.
