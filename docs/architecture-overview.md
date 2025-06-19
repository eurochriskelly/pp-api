# Codebase Architecture Overview

This document provides a concise overview of the project's structure and patterns. It serves as a quick reference for maintaining and extending the API.

## 1. Core Architecture: Controller-Service

The application follows a standard **Controller-Service** pattern to ensure a clear separation of concerns.

-   **Controllers (`src/api/controllers/`)**: Handle HTTP requests and responses. They are the "glue" layer and should not contain business logic.
-   **Services (`src/api/services/`)**: Contain all business logic, data manipulation, and database interactions. They are completely unaware of the HTTP layer.

### Request Flow

A typical request follows this path:

1.  **Entry Point (`src/server.js`)**: Initializes the server, DB connection, and determines `mock` mode.
2.  **API Router (`src/api/index.js` or `src/api/routes/*.js`)**: Matches the request URL to a specific controller function.
3.  **Controller (`src/api/controllers/*.js`)**: Parses the request (`req`) and calls the appropriate service method.
4.  **Service (`src/api/services/*.js`)**: Executes the business logic, often using `db-helper.js` to interact with the database.
5.  **Response**: The service returns data to the controller, which formats and sends the final HTTP response (`res`).

## 2. Mocking System

A key feature is the parallel **mocking system**, which allows the API to run without a database connection.

-   **Real Services**: `src/api/services/`
-   **Mock Services**: `src/api/services/mocks/`

Controllers use a **service factory** to dynamically select the correct service based on the `useMock` flag.

```javascript
// Pattern from controllers/tournaments.js and controllers/auth.js
const serviceFactory = useMock
  ? require("../services/mocks/[feature]")
  : require("../services/services/[feature]");
const dbSvc = serviceFactory(db);
```

**Rule**: Any new service function must have a corresponding mock implementation.

## 3. Directory Structure

-   `src/api/controllers/`: Request/response handlers.
-   `src/api/routes/`: (Optional but preferred) Modular route definitions for a specific feature (e.g., `auth.js`).
-   `src/api/services/`: Business logic and database interaction.
-   `src/api/services/mocks/`: Mock implementations of the services for `useMock` mode.
-   `src/lib/`: Core shared utilities.
    -   `db-helper.js`: The **only** place where direct database queries are executed. All services must use this.
    -   `queries.js`: Stores complex, reusable SQL queries.
-   `src/api/index.js`: Main API setup, middleware, and route mounting.
-   `src/server.js`: Application entry point.

## 4. How to Add/Maintain Endpoints

Follow this established pattern:

1.  **Define the Route**:
    -   For a new feature, create a file in `src/api/routes/`.
    -   For an existing feature, add the route to its existing router file or to `src/api/index.js`.

2.  **Create the Controller Function**:
    -   Add a function to the appropriate file in `src/api/controllers/`.
    -   It should parse `req.body`, `req.params`, etc., and call the service.
    -   Use the `handleRoute` wrapper (from `tournaments.js`) for consistency where possible.

3.  **Implement the Service Function**:
    -   Add the core business logic to the corresponding file in `src/api/services/`.
    -   Use `db-helper` for all database operations.

4.  **Implement the Mock Service Function**:
    -   Add a parallel function to the corresponding file in `src/api/services/mocks/`.
    -   It must return realistic, static data that matches the real service's output structure.
