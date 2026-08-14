# Gemini Project Analysis

## Project Overview

This project is a Node.js web API for managing sports tournaments. It is built with Express.js and uses TypeScript. The API provides endpoints for managing tournaments, fixtures, regions, squads, and players. It uses a MySQL database for data storage and has a mock mode for development and testing.

The project follows a typical Model-View-Controller (MVC) pattern, with routes, controllers, and services separated into different modules. The database logic is handled by the `mysql2` package, and there are helper functions for database interactions.

## Building and Running

### Prerequisites

*   Node.js
*   npm
*   MySQL (or use mock mode)

### Installation

1.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

*   **Development Mode (with file watching):**
    ```bash
    npm run dev
    ```
    This command uses `tsx watch src/server.ts` to automatically re-run TypeScript files on changes.

*   **Production Mode:**
    ```bash
    npm start
    ```
    This command first builds the TypeScript files into JavaScript (`npm run build`) and then starts the server from the `dist` directory.

*   **Acceptance Mode:**
    ```bash
    npm run start:acc
    ```
    This command uses `task` to start the application in acceptance mode.

### Testing

*   **Interactive Tests:**
    ```bash
    npm run interactive
    ```
    This runs the `test/interactive.js` script.

*   **API Tests:**
    ```bash
    npm run test:api
    ```
    This runs the automated API test suites.

*   **Contract Tests:**
    ```bash
    npm run verify:contract
    ```
    This builds the project and runs the contract/parity test suite.

### Linting

*   **Check for linting errors:**
    ```bash
    npm run lint
    ```

*   **Fix linting errors:**
    ```bash
    npm run lint:fix
    ```

## Development Conventions

*   **TypeScript:** The project uses TypeScript for type safety. All new code should be written in TypeScript.
*   **Controllers:** Business logic is separated into controllers, which are called by the routes.
*   **Services:** Database access and other reusable logic are placed in services.
*   **Linting:** The project uses ESLint for code style and quality. Before committing, run `npm run lint` to check for errors.
*   **Mock Mode:** The application can be run in a mock mode by passing the `--database=MockTourno` argument. This is useful for development and testing without a database connection.
