# Codebase Architecture Overview

This document provides a concise overview of the project's structure and patterns. It serves as a quick reference for maintaining and extending the API.

## 1. Core Architecture: Routes → Controllers → Services

The application follows a three-layer architecture to ensure a clear separation of concerns.

-   **Routes (`src/api/routes/`)**: Map URL paths to controllers. Each resource has its own route module, often with nested sub-routes (e.g. `tournaments/fixtures`).
-   **Controllers (`src/api/controllers/`)**: Handle HTTP requests and responses. They are the "glue" layer and should not contain business logic.
-   **Services (`src/api/services/`)**: Contain all business logic, data manipulation, and database interactions. They are completely unaware of the HTTP layer.

### Request Flow

1.  **Entry Point (`src/server.ts`)**: Initializes the server, loads environment config, attempts the database connection, and determines `mock` mode.
2.  **API Setup (`src/api/index.ts`)**: Mounts route modules under `/api/*`, applies global middleware (security headers, CORS, rate limiting, request logging), and starts the HTTP server.
3.  **Route (`src/api/routes/*.ts`)**: Matches the request URL to a specific controller function. Route modules also apply per-route middleware such as authentication (`protect`) and role checks (`requireRole`).
4.  **Controller (`src/api/controllers/*.ts`)**: Parses the request (`req.body`, `req.params`, etc.) and calls the appropriate service method.
5.  **Service (`src/api/services/*.ts`)**: Executes the business logic, using `db-helper` to interact with the database when needed.
6.  **Response**: The service returns data to the controller, which formats and sends the final HTTP response (`res`).

## 2. Mocking System

A key feature is the parallel **mocking system**, which allows the API to run without a database connection.

-   **Real Services**: `src/api/services/`
-   **Mock Services**: `src/api/services/mocks/`

Controllers use a **service factory** to dynamically select the correct service based on the `useMock` flag.

```typescript
// Pattern used in controllers
import serviceFactory from '../services/tournaments';
import mockServiceFactory from '../services/mocks/tournaments';

function controller(db: any, useMock: boolean) {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);
  // ...
}

export = controller;
```

**Rule**: Any new public service function must have a corresponding mock implementation. The parity test (`test/unit/api/services/mock-parity.spec.ts`) enforces this in CI.

## 3. Directory Structure

-   `src/api/controllers/`: Request/response handlers.
-   `src/api/routes/`: Modular route definitions for each resource.
-   `src/api/services/`: Business logic and database interaction.
-   `src/api/services/mocks/`: Mock implementations of the services for `useMock` mode.
-   `src/api/middleware/`: Shared Express middleware (`auth.ts`, `authorization.ts`, `validation.ts`).
-   `src/lib/`: Core shared utilities.
    -   `db-helper.ts`: The primary database helper. Direct SQL is confined to services.
    -   `queries.ts`: Stores complex, reusable SQL queries.
-   `src/api/index.ts`: Main API setup, global middleware, and route mounting.
-   `src/server.ts`: Application entry point.
-   `docs/api/`: Generated OpenAPI documentation.
-   `scripts/generate-openapi-spec.js`: Generates `docs/api/openapi.yaml` and `docs/api/openapi.json` from the route tree.

## 4. How to Add/Maintain Endpoints

Follow this established pattern:

1.  **Define the Route**:
    -   For a new feature, create a route module in `src/api/routes/<resource>/index.ts` and register it in `src/api/index.ts`.
    -   For an existing feature, add the route to its existing router file.

2.  **Create the Controller Function**:
    -   Add a function to the appropriate file in `src/api/controllers/`.
    -   It should parse `req.body`, `req.params`, etc., and call the service.
    -   Use the standard error pattern: validate inputs, return 400/404 as needed, and pass unexpected errors to `next(err)`.

3.  **Implement the Service Function**:
    -   Add the core business logic to the corresponding file in `src/api/services/`.
    -   Use `db-helper` for all database operations.

4.  **Implement the Mock Service Function**:
    -   Add a parallel function to the corresponding file in `src/api/services/mocks/`.
    -   It must return realistic, static data that matches the real service's output structure.

5.  **Protect Mutation Endpoints**:
    -   Apply the `protect` middleware from `src/api/middleware/auth.ts` to routes that modify state.
    -   Use `requireRole(['admin'])` or `requireRole(['organizer', 'admin'])` where appropriate.

6.  **Update Documentation and Tests**:
    -   Run `npm run generate:openapi` to refresh the API spec.
    -   Add or update unit tests under `test/unit/` and contract tests under `test/unit/api/routes/`.

## 5. Security and Operations

-   **Authentication**: JWT-based auth via `src/api/middleware/auth.ts`. A dev bypass token is available only when `NODE_ENV !== 'production'` and `PP_BYPASS_AUTH=1`.
-   **Authorization**: `src/api/middleware/authorization.ts` provides `requireRole` for role-based access control.
-   **Headers/CORS/Rate limiting**: Applied globally in `src/api/index.ts`. Configure production CORS origins via `PP_ALLOWED_ORIGINS`.
-   **Mock fallback**: Database failures do not silently fall back to mock mode in production. Set `PP_ALLOW_MOCK_FALLBACK=1` in non-production to enable fallback.
-   **Hardening plan**: See `docs/tasks/architecture-hardening-plan.md` for the current resumable improvement plan.
