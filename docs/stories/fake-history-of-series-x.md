# Fake History: Series X (Start to Finish)

This is a fictional walkthrough of how an organizer could create and run a championship setup from scratch using the new APIs.

## 0. Starting Point

Assume the championship migration has already been run and these tables exist:

- `rulesets`
- `series`
- `championships`
- `championship_entrants`
- `amalgamation_clubs`
- `tournament_teams`
- `team_entrants`
- plus `tournaments` with `championshipId` and `roundNumber`

## 1. Create the Ruleset

A competition admin defines how points and tie-breakers work.

Endpoint:

- `POST /api/rulesets` (auth)

Example body:

```json
{
  "name": "Series X Standard Rules",
  "description": "Default scoring for Series X",
  "configVersion": "1.0",
  "config": {
    "points": { "win": 2, "draw": 1, "loss": 0 },
    "tieBreakers": ["pointsDifference", "pointsScored", "headToHead"]
  }
}
```

Result:

- A `rulesets.id` is created (example: `17`).

## 2. Create the Series

Series X is the long-lived competition template.

Endpoint:

- `POST /api/series` (auth)

Example body:

```json
{
  "name": "Series X",
  "description": "Pan-regional championship framework",
  "sport": "football",
  "defaultSquadSize": 15,
  "defaultPlayersPerTeam": 15,
  "rulesetId": 17,
  "status": "active"
}
```

Result:

- A `series.id` is created (example: `9`).

## 3. Create the Championship Season

The organizer creates a specific season instance, e.g. 2026.

Endpoint:

- `POST /api/championships` (auth)

Example body:

```json
{
  "seriesId": 9,
  "name": "Series X 2026",
  "year": 2026,
  "numRounds": 4,
  "squadSize": 18,
  "playersPerTeam": 15,
  "status": "draft"
}
```

Result:

- A `championships.id` is created (example: `31`).

## 4. Register Entrants

### 4.1 Register a Club Entrant

Endpoint:

- `POST /api/championships/31/entrants` (auth)

Example body:

```json
{
  "entrantType": "club",
  "clubId": 101,
  "displayName": "Amsterdam GAC",
  "status": "registered"
}
```

### 4.2 Register an Amalgamation Entrant

Endpoint:

- `POST /api/championships/31/entrants` (auth)

Example body:

```json
{
  "entrantType": "amalgamation",
  "displayName": "Paris + Bordeaux",
  "status": "active"
}
```

Assume this entrant gets id `77`.

### 4.3 Link Clubs to the Amalgamation

Endpoint:

- `POST /api/championships/31/entrants/77/amalgamation-clubs` (auth)

Example body:

```json
{ "clubId": 204 }
```

Run again for each contributing club.

## 5. Plan Round Tournaments

Now event instances are created in `tournaments`, each linked back to the championship and round.

Endpoint:

- `POST /api/tournaments`

Example body:

```json
{
  "userId": 42,
  "region": "Pan-Euro",
  "title": "Series X Round 1 - Amsterdam",
  "date": "2026-04-12",
  "location": "Amsterdam",
  "lat": 52.3676,
  "lon": 4.9041,
  "codeOrganizer": "1234",
  "championshipId": 31,
  "roundNumber": 1,
  "winPoints": 2,
  "drawPoints": 1,
  "lossPoints": 0
}
```

Repeat for rounds 2-4 (or update later via `PUT /api/tournaments/:id`).

## 6. Build Tournament Teams from Entrants

For each round tournament (example `tournamentId = 501`), create participating teams.

Endpoint:

- `POST /api/tournaments/501/teams` (auth)

Examples:

```json
{
  "entrantId": 61,
  "teamName": "Amsterdam A",
  "teamType": "primary"
}
```

```json
{
  "entrantId": 77,
  "teamName": "Paris + Bordeaux Select",
  "teamType": "combination"
}
```

## 7. Submit Squad Size and Generate Placeholder Players

When team sheets are not complete yet, submit size to generate placeholders.

Endpoint:

- `POST /api/tournaments/501/teams/:teamId/squad` (auth)

Example:

```json
{ "squadSize": 15 }
```

Result:

- `tournament_teams.squadSizeSubmitted` is set.
- A linked internal squad row is created/reused.
- Placeholder players (`Player 1`, `Player 2`, etc.) are created as needed.

## 8. Reassign a Player Between Teams

If a player is assigned to the wrong team:

Endpoint:

- `PUT /api/tournaments/501/teams/:fromTeamId/players/:playerId/assign` (auth)

Example:

```json
{ "toTeamId": 902 }
```

Result:

- Player moves from source team’s linked squad to destination team’s linked squad.

## 9. Track Progress

Use these reads during the season:

- `GET /api/series/9`
- `GET /api/series/9/championships`
- `GET /api/championships/31`
- `GET /api/championships/31/entrants`
- `GET /api/championships/31/rounds`
- `GET /api/championships/31/standings` (currently basic placeholder output)
- `GET /api/tournaments/501/teams`

## 10. End of Season

At season completion:

- mark championship status (`PUT /api/championships/31`) to `completed`
- archive later if needed (`DELETE /api/championships/31` currently archives status)
- keep `series` active for next year’s championship creation

## Notes on Current Behavior

- Championship standings are currently scaffolded and return a basic row-per-entrant shape.
- Tournament-team squad linkage is implemented through existing `squads`/`players` storage.
- Entrant detail routes support both canonical and compatibility URL patterns.
