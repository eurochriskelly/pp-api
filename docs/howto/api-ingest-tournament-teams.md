# Tournament Teams API Ingestion Guide

This document describes how to ingest tournament team data from an external system into the PP-API.

## Overview

The Teams API supports a two-phase workflow:

1. **Ingest Phase**: Import teams with a temporary UUID (batch upload from external system)
2. **Assignment Phase**: Later associate the batch with a real internal tournament

This allows teams to be collected and stored before the internal tournament record exists.

## Data Model

### Teams Table Schema

```sql
CREATE TABLE IF NOT EXISTS teams (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,           -- Team name (e.g., "AMSTERDAM GFC")
  tournamentTempUuid CHAR(36) NOT NULL, -- Temporary batch identifier
  tournamentId INT DEFAULT NULL,        -- Real tournament ID (assigned later)
  competition VARCHAR(255) DEFAULT NULL, -- Competition name within tournament
  contributingClubs JSON DEFAULT NULL,  -- Club composition data
  logo LONGBLOB DEFAULT NULL,           -- PNG image blob
  colors JSON DEFAULT NULL,             -- Team colors
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_teams_tournament_temp_uuid (tournamentTempUuid),
  KEY ix_teams_tournament_id (tournamentId),
  KEY ix_teams_competition (competition)
) ENGINE=InnoDB;
```

### Contributing Clubs JSON Structure

```json
{
  "managingClub": "club1",
  "contributingClubs": [
    {
      "clubId": "club1",
      "numPlayers": 8,
      "name": "Amsterdam GFC",
      "shortName": "AMST",
      "code": "AM"
    },
    {
      "clubId": "club2",
      "numPlayers": 5,
      "name": "Den Haag",
      "shortName": "HAAG",
      "code": "DH"
    }
  ]
}
```

**Notes:**

- `clubId` is optional and may not be known at ingest time
- Club matching for aggregation is done by normalized `name` field
- `numPlayers` represents the number of players from that club on this team

## API Endpoints

### 1. Batch Create Teams

Create multiple teams at once with a shared temporary UUID.

**Endpoint:** `POST /api/teams/batch`

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "tournamentTempUuid": "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c",
  "teams": [
    {
      "name": "AMSTERDAM GFC",
      "competition": "Senior Cup",
      "contributingClubs": {
        "managingClub": "club1",
        "contributingClubs": [
          {
            "clubId": "club1",
            "numPlayers": 8,
            "name": "Amsterdam GFC",
            "shortName": "AMST",
            "code": "AM"
          },
          {
            "clubId": "club2",
            "numPlayers": 5,
            "name": "Den Haag",
            "shortName": "HAAG",
            "code": "DH"
          }
        ]
      },
      "colors": {
        "primary": "#005BBB",
        "secondary": "#FFD500"
      }
    },
    {
      "name": "ROTTERDAM HURLERS",
      "competition": "Senior Cup",
      "contributingClubs": {
        "managingClub": "club3",
        "contributingClubs": [
          {
            "clubId": "club3",
            "numPlayers": 12,
            "name": "Rotterdam GAA",
            "shortName": "ROT",
            "code": "RT"
          }
        ]
      },
      "colors": {
        "primary": "#C8102E",
        "secondary": "#FFFFFF"
      }
    }
  ]
}
```

**Response:** `201 Created`

```json
{
  "data": [
    {
      "id": 1,
      "name": "AMSTERDAM GFC",
      "tournamentTempUuid": "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c",
      "tournamentId": null,
      "competition": "Senior Cup",
      "contributingClubs": {
        "managingClub": "club1",
        "contributingClubs": [
          {
            "clubId": "club1",
            "numPlayers": 8,
            "name": "Amsterdam GFC",
            "shortName": "AMST",
            "code": "AM"
          },
          {
            "clubId": "club2",
            "numPlayers": 5,
            "name": "Den Haag",
            "shortName": "HAAG",
            "code": "DH"
          }
        ]
      },
      "colors": {
        "primary": "#005BBB",
        "secondary": "#FFD500"
      },
      "createdAt": "2026-02-27T14:30:00.000Z",
      "updatedAt": "2026-02-27T14:30:00.000Z"
    },
    {
      "id": 2,
      "name": "ROTTERDAM HURLERS",
      "tournamentTempUuid": "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c",
      "tournamentId": null,
      "competition": "Senior Cup",
      "contributingClubs": {
        "managingClub": "club3",
        "contributingClubs": [
          {
            "clubId": "club3",
            "numPlayers": 12,
            "name": "Rotterdam GAA",
            "shortName": "ROT",
            "code": "RT"
          }
        ]
      },
      "colors": {
        "primary": "#C8102E",
        "secondary": "#FFFFFF"
      },
      "createdAt": "2026-02-27T14:30:00.000Z",
      "updatedAt": "2026-02-27T14:30:00.000Z"
    }
  ]
}
```

### 2. Upload Team Logo

Upload a PNG logo for a team. Must be done after the team is created.

**Endpoint:** `POST /api/teams/:id/logo`

**Headers:**

```
Content-Type: image/png
Authorization: Bearer <token>
```

**Body:** Binary PNG data (raw bytes)

**Response:** `200 OK`

```json
{
  "data": {
    "id": 1,
    "affectedRows": 1
  }
}
```

### 3. Assign Tournament

Once the internal tournament is created, associate all teams in a batch with the real tournament ID.

**Endpoint:** `POST /api/teams/assign-tournament`

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "tournamentTempUuid": "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c",
  "tournamentId": 123
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "tournamentTempUuid": "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c",
    "tournamentId": 123,
    "affectedRows": 2
  }
}
```

### 4. Get Tournament Clubs

Retrieve a deduplicated list of all clubs participating in a tournament, with their associated teams.

**Endpoint:** `GET /api/tournaments/:tournamentId/clubs`

**Response:** `200 OK`

```json
{
  "data": [
    {
      "clubName": "Amsterdam GFC",
      "clubId": "club1",
      "shortName": "AMST",
      "code": "AM",
      "teams": [
        {
          "teamId": 1,
          "teamName": "AMSTERDAM GFC",
          "competition": "Senior Cup",
          "numPlayers": 8
        }
      ]
    },
    {
      "clubName": "Den Haag",
      "clubId": "club2",
      "shortName": "HAAG",
      "code": "DH",
      "teams": [
        {
          "teamId": 1,
          "teamName": "AMSTERDAM GFC",
          "competition": "Senior Cup",
          "numPlayers": 5
        }
      ]
    },
    {
      "clubName": "Rotterdam GAA",
      "clubId": "club3",
      "shortName": "ROT",
      "code": "RT",
      "teams": [
        {
          "teamId": 2,
          "teamName": "ROTTERDAM HURLERS",
          "competition": "Senior Cup",
          "numPlayers": 12
        }
      ]
    }
  ]
}
```

**Notes:**

- Clubs are deduplicated by normalized name (case-insensitive)
- If the same club appears in multiple teams, it will have multiple entries in the `teams` array
- Teams are matched by `tournamentId` first, falling back to `tournamentTempUuid = tournaments.eventUuid`

### 5. Query Teams

List teams with optional filtering.

**Endpoint:** `GET /api/teams`

**Query Parameters:**

- `tournamentTempUuid` (optional) - Filter by batch UUID
- `tournamentId` (optional) - Filter by assigned tournament
- `competition` (optional) - Filter by competition name

**Example:** `GET /api/teams?tournamentTempUuid=7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c`

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "name": "AMSTERDAM GFC",
      "tournamentTempUuid": "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c",
      "tournamentId": 123,
      "competition": "Senior Cup",
      "contributingClubs": { ... },
      "colors": { ... },
      "createdAt": "2026-02-27T14:30:00.000Z",
      "updatedAt": "2026-02-27T14:30:00.000Z"
    }
  ]
}
```

### 6. Get Single Team

**Endpoint:** `GET /api/teams/:id`

**Response:** `200 OK` or `404 Not Found`

### 7. Update Team

**Endpoint:** `PUT /api/teams/:id`

**Request Body:** (partial update, any fields)

```json
{
  "name": "AMSTERDAM GFC A",
  "competition": "Senior A Cup",
  "colors": {
    "primary": "#000000",
    "secondary": "#FFFFFF"
  }
}
```

**Response:** `200 OK`

### 8. Get Team Logo

**Endpoint:** `GET /api/teams/:id/logo`

**Response:** `200 OK` with `Content-Type: image/png` and binary PNG data, or `404 Not Found`

## Complete Workflow Example

```javascript
// Step 1: Generate a temporary UUID for this batch
const tempUuid = generateUUID(); // e.g., "7ef0c7b7-347e-4473-a0f5-d3cdd6fbf76c"

// Step 2: Ingest all teams from external system
const teamsData = await fetchTeamsFromExternalSystem();

const response = await fetch('/api/teams/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tournamentTempUuid: tempUuid,
    teams: teamsData.map(team => ({
      name: team.name,
      competition: team.competition,
      contributingClubs: {
        managingClub: team.managingClubId,
        contributingClubs: team.clubs.map(club => ({
          clubId: club.id,
          numPlayers: club.playerCount,
          name: club.name,
          shortName: club.shortName,
          code: club.code
        }))
      },
      colors: team.colors
    }))
  })
});

const createdTeams = await response.json();

// Step 3: Upload logos for each team
for (const team of createdTeams.data) {
  const logoBuffer = await fetchTeamLogo(team.name);
  await fetch(`/api/teams/${team.id}/logo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'Authorization': `Bearer ${token}`
    },
    body: logoBuffer
  });
}

// Step 4: Later, when tournament is created internally
const tournamentResponse = await createInternalTournament({ ... });
const tournamentId = tournamentResponse.data.id;

// Step 5: Assign the batch to the real tournament
await fetch('/api/teams/assign-tournament', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tournamentTempUuid: tempUuid,
    tournamentId: tournamentId
  })
});

// Step 6: Query aggregated club data
const clubsResponse = await fetch(`/api/tournaments/${tournamentId}/clubs`);
const clubsData = await clubsResponse.json();
console.log('Participating clubs:', clubsData.data);
```

## Error Handling

### Validation Errors (400)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "tournamentTempUuid and non-empty teams[] are required"
}
```

### Not Found (404)

```json
{
  "error": "NOT_FOUND"
}
```

### Invalid ID (400)

```json
{
  "error": "INVALID_ID"
}
```

### Invalid Tournament ID (400)

```json
{
  "error": "INVALID_TOURNAMENT_ID"
}
```

## Best Practices

1. **Generate UUIDs**: Use standard UUID v4 for `tournamentTempUuid`
2. **Batch Size**: Keep batch sizes reasonable (e.g., < 100 teams per request)
3. **Logo Upload**: Upload logos after team creation; use PNG format
4. **Idempotency**: The batch create is not idempotent; calling it twice with the same UUID will create duplicate teams
5. **Club Names**: Ensure club names are consistent within a batch for proper deduplication
6. **Colors**: Store colors as hex strings (e.g., `"#005BBB"`)
7. **Club ID**: If club IDs are not known at ingest time, they can be added later via update

## Data Integrity Notes

- **Club Uniqueness**: Clubs are matched by normalized name (lowercase, trimmed). If "Amsterdam GFC" and "amsterdam gfc" appear, they are treated as the same club.
- **Tournament Assignment**: Teams can be queried by either `tournamentTempUuid` (during ingest phase) or `tournamentId` (after assignment)
- **Logo Storage**: Logos are stored as binary PNG blobs; no transformations are applied
- **Soft References**: The `clubId` in contributing clubs is optional and used for future reconciliation when IDs become known

---

**Last Updated:** 2026-02-27  
**API Version:** 1.6.14
