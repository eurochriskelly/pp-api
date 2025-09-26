# API Documentation Enhancement Plan

## Overview

This document outlines a gradual, incremental approach to enhance API documentation by connecting existing OpenAPI schemas to generated endpoint documentation. The goal is to transform generic "object" responses into properly typed, schema-referenced documentation that developers can actually use.

## Core Philosophy

- **One API endpoint at a time** - Test each change before moving to the next
- **No big refactoring** - Work with existing code structure
- **Manual schema mapping** - Start simple, avoid complex type extraction
- **Gradual enhancement** - Build confidence with each successful change

## Current State

The current API documentation generator (`scripts/generate-api-docs.js`) produces:

- ✅ Correct endpoint paths and HTTP methods
- ✅ Path parameters (e.g., `{id}`)
- ✅ Basic request bodies for POST/PUT
- ❌ Generic "object" response schemas
- ❌ Missing query parameters
- ❌ No connection to existing OpenAPI schemas

## Phase 1: Manual Schema Mapping (Start Here)

**Goal**: Connect existing schemas to endpoints without code changes

### Process per endpoint:

1. Identify the controller method
2. Find the corresponding OpenAPI schema in `docs/api/components/schemas/`
3. Update the generated YAML file manually
4. Test the documentation
5. Commit and verify

### Example for `/tournaments/{id}` (GET):

**Before:**

```yaml
responses:
  '200':
    description: 'Success'
    content:
      application/json:
        schema:
          type: object
```

**After:**

```yaml
responses:
  '200':
    description: 'Success'
    content:
      application/json:
        schema:
          $ref: '../../components/schemas/Tournament.yaml'
```

### Schema Mapping Reference:

| Endpoint Pattern                 | Response Schema                  | Notes               |
| -------------------------------- | -------------------------------- | ------------------- |
| `GET /tournaments`               | `TournamentSummary.yaml` (array) | List of tournaments |
| `GET /tournaments/{id}`          | `Tournament.yaml`                | Single tournament   |
| `POST /tournaments`              | `Tournament.yaml`                | Created tournament  |
| `PUT /tournaments/{id}`          | `Tournament.yaml`                | Updated tournament  |
| `GET /tournaments/{id}/fixtures` | `Fixture.yaml` (array)           | Tournament fixtures |
| `GET /tournaments/{id}/squads`   | `Squad.yaml` (array)             | Tournament squads   |
| `POST /tournaments/{id}/squads`  | `Squad.yaml`                     | Created squad       |
| `GET /players`                   | `Player.yaml` (array)            | List of players     |
| `POST /players`                  | `Player.yaml`                    | Created player      |

## Phase 2: Query Parameter Documentation

**Goal**: Add missing query parameters to documentation

### Process per endpoint:

1. Check controller code for `req.query` usage
2. Add query parameters to the YAML file
3. Use TypeScript types as reference for parameter types

### Example for tournament listing:

```yaml
parameters:
  - name: status
    in: query
    required: false
    schema:
      type: string
      enum: [active, completed, upcoming]
    description: 'Filter tournaments by status'
  - name: category
    in: query
    required: false
    schema:
      type: string
    description: 'Filter by tournament category'
```

### Common Query Parameters:

| Parameter  | Type          | Description               | Used In               |
| ---------- | ------------- | ------------------------- | --------------------- |
| `status`   | string (enum) | active/completed/upcoming | tournaments           |
| `category` | string        | Tournament category       | tournaments, fixtures |
| `userId`   | string        | User ID filter            | tournaments           |
| `role`     | string        | User role filter          | tournaments           |
| `region`   | string        | Geographic region         | tournaments           |
| `stage`    | string        | Tournament stage          | fixtures, standings   |
| `group`    | string/number | Group identifier          | fixtures, standings   |

## Phase 3: Request Body Enhancement

**Goal**: Reference creation schemas for POST/PUT operations

### Example for tournament creation:

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: '../../components/schemas/TournamentCreate.yaml'
```

### Request Body Mapping:

| Endpoint                            | Request Schema          | Notes               |
| ----------------------------------- | ----------------------- | ------------------- |
| `POST /tournaments`                 | `TournamentCreate.yaml` | Tournament creation |
| `PUT /tournaments/{id}`             | `TournamentCreate.yaml` | Tournament update   |
| `POST /tournaments/{id}/squads`     | `SquadCreate.yaml`      | Squad creation      |
| `PUT /tournaments/{id}/squads/{id}` | `SquadCreate.yaml`      | Squad update        |
| `POST /players`                     | `PlayerCreate.yaml`     | Player creation     |
| `PUT /players/{id}`                 | `PlayerCreate.yaml`     | Player update       |

## Phase 4: Zod Integration (Future)

**Goal**: Use existing Zod schemas for documentation

**Only after Phases 1-3 are working:**

- Extract schemas from controllers like `cardPlayerSchema` in `fixtures.js`
- Convert Zod schemas to OpenAPI format
- Automate schema generation

## Implementation Priority

**Start with high-impact, low-risk endpoints:**

1. **GET /tournaments** - Simple list, uses `TournamentSummary.yaml`
2. **GET /tournaments/{id}** - Single item, uses `Tournament.yaml`
3. **POST /tournaments** - Creation, uses `TournamentCreate.yaml`
4. **GET /tournaments/{id}/fixtures** - Related data
5. **POST /auth/login** - Authentication (already has JSDoc)

## Testing Strategy

**After each endpoint:**

1. Run `npm run api` to regenerate docs
2. Check that the HTML documentation shows proper schemas
3. Verify parameter descriptions are accurate
4. Test API calls to ensure schemas match actual responses

## Success Criteria

- Documentation accurately reflects API behavior
- Schemas provide useful information for developers
- No breaking changes to existing functionality
- Each change is independently testable

## Workflow

1. **Choose an endpoint** from the priority list
2. **Examine the controller** to understand request/response structure
3. **Find the appropriate schema** in `docs/api/components/schemas/`
4. **Update the YAML file** in `docs/api/paths/{resource}/`
5. **Test the documentation** with `npm run api`
6. **Commit the change** with a descriptive message
7. **Move to the next endpoint**

## Tools and Commands

```bash
# Regenerate documentation
node scripts/generate-api-docs.js

# Build and serve documentation
npm run api

# Check generated YAML files
ls docs/api/paths/*/get-*.yaml
```

## Risk Mitigation

- **Backup generated files** before manual edits
- **Test API functionality** after each change
- **Review documentation** in browser before committing
- **Revert changes** if issues are found

This approach lets us improve documentation quality incrementally while maintaining system stability. We can accelerate once we have confidence in the process.
