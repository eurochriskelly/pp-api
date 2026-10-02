# Fixture outcome contract

`fixtures.outcome` is always one of `not played`, `in-progress`, `played`, or
`skipped`. It is never `NULL`.

Use `POST /api/tournaments/:tournamentId/fixtures/:fixtureId/start` when a
match begins. This sets the outcome to `in-progress`.

Use `POST /api/tournaments/:tournamentId/fixtures/:fixtureId/score` to save a
score. Its body must always contain both teams' `goals` and `points` values:

```json
{
  "outcome": "in-progress",
  "scores": {
    "team1": { "goals": 1, "points": 4 },
    "team2": { "goals": 1, "points": 2 }
  }
}
```

While entering a live score, send `outcome: "in-progress"`. If older clients
omit `outcome`, the API also stores `in-progress`; it never stores `NULL`.
Record cards through the card endpoint while the match is in progress. When
the score and cards are final, send the same score payload with
`outcome: "played"`, then call the `end` endpoint if the UI records an end
time separately.

For an administrative non-played result, send the agreed final score with
`outcome: "skipped"`. A skipped win contributes one competition point to the
winner and zero to the loser. A skipped draw uses the tournament's normal draw
award. `conceded` and `forfeit` are not API outcomes; existing records with
those values are migrated to `skipped`.

`not played` is the initial/reset state. It and `in-progress` are excluded
from standings, head-to-head, advancement, and final rankings. `played` and
`skipped` are included only when both teams have a complete score.
