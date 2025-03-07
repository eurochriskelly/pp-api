# Contribition
Below is the `contributors-guide.md` file generated based on your front-end code for the tournament management system. This guide is designed to help new contributors understand the project structure, set up their development environment, adhere to coding standards, and contribute effectively while maintaining the existing style and functionality. After this, we can discuss potential usability improvements as requested.

---

# Contributors Guide

Welcome to the Tournament Management System! This project provides a command-line interface (CLI) tool and a web interface for managing Gaelic games tournaments. It allows users to schedule tournaments, simulate matches, import data, and view results, all while communicating with a server via a REST API.

## Project Structure

The project is organized into the following directories:

- **`bin/`**: Contains the CLI entry point (`gcp.ts`), which uses Commander.js to define commands for managing tournaments, importing data, simulating matches, and launching the web server.
- **`src/import/`**: Manages importing club and fixture data from CSV files, generating SQL statements, or making API calls to update the server.
- **`src/populate/`**: Offers interactive tools for populating tournament schedules using user input and validation logic.
- **`src/simulation/`**: Handles simulation of tournament matches, including displaying competition data and retrieving schedules/fixtures via API calls.
- **`src/ui/`**: Contains the web interface components, including API wrappers (`api.js`), server setup with Express.js (`server.js`), and query functions (`queries.js`) for fetching tournament data.
- **`src/ui/styles/`**: Holds CSS styles (`main.css`) for the web interface's visual design.
- **`src/ui/templates/`**: Includes functions to generate HTML for various views, such as tournament selection, match planning, execution reports, and fixture imports.

## Setting Up the Development Environment

1. **Clone the Repository**:
   ```sh
   git clone https://github.com/your-repo/tournament-management.git
   cd tournament-management
   ```

2. **Install Dependencies**:
   ```sh
   npm install
   ```
   Ensure Node.js and npm are installed on your system.

3. **Configure Environment Variables**:
   - Create a `.env` file in the project root with necessary variables (e.g., `GCP_DB_HOST`, `GCP_DB_USER`, `GCP_DB_PWD`, `GCP_DB_NAME` for direct database access, though API usage is preferred). Refer to the project's documentation or existing code for specifics.

4. **Build the Project**:
   ```sh
   npm run build
   ```
   This compiles TypeScript files into JavaScript in the `dist/` directory.

## Coding Standards

- **Language**: TypeScript with ES6+ features.
- **Naming Conventions**: Use camelCase for variables and functions (e.g., `generateFixturesImport`, `tournamentId`).
- **Type Safety**: Define interfaces and types (e.g., `IClub`, `Fixture`) to ensure type safety throughout the codebase.
- **Async Operations**: Use `async/await` for asynchronous operations, especially API calls and file I/O (e.g., `await apiRequest(...)`).
- **Comments**: Add comments for complex logic and maintain existing comments for clarity (e.g., `// Step 1: Clear existing data`).
- **Formatting**: Use 2-space indentation, consistent with the existing code. Run Prettier if configured.
- **Dependencies**: Leverage existing libraries like `axios`, `commander`, `express`, and `htmx`. Introduce new dependencies only if necessary and compatible with the stack.

## Running the Application

- **CLI Tool**:
  ```sh
  node bin/gcp.js [command] [options]
  ```
  Example commands:
  - List tournaments: `node bin/gcp.js --list-tournaments`
  - Simulate matches: `node bin/gcp.js --play -t <tournament-id> --count 5`
  - See all commands: `node bin/gcp.js --help`

- **Web Server**:
  ```sh
  node src/ui/server.js [port]
  ```
  - Default port is 5421 (e.g., `http://localhost:5421`).
  - Optional `--bypass-auth` flag for testing without authentication: `node src/ui/server.js 5421 --bypass-auth`.

## Interacting with the API

- The system uses a REST API at `http://192.168.1.147:4000/api` (configurable via `API_BASE_URL` in `src/ui/api.js`).
- API requests are handled by Axios in `src/ui/api.js`. Example:
  ```javascript
  const data = await apiRequest('get', `/tournaments/${tournamentId}/fixtures`);
  ```
- All server interactions should go through the API rather than direct database access (note: `src/ui/db.js` is marked for replacement with API calls).
- Authentication may be required for certain endpoints; ensure proper session handling in the web interface.

## Contributing

1. **Create a Feature Branch**:
   ```sh
   git checkout -b feature/your-feature-name
   ```

2. **Write Code**:
   - Adhere to the coding standards and directory structure.
   - Add or update tests if applicable (currently minimal; consider adding unit tests with a framework like Jest).

3. **Test Your Changes**:
   - Run the CLI (`node bin/gcp.js`) and web server (`node src/ui/server.js`) to verify functionality.
   - Test API interactions manually or automate with tools like Postman if endpoints change.
   - Ensure no regressions in existing features (e.g., tournament listing, fixture imports).

4. **Commit and Push**:
   ```sh
   git add .
   git commit -m " feat: add usability improvement to X"
   git push origin feature/your-feature-name
   ```
   - Use descriptive commit messages (e.g., "fix: resolve import error in CSV parsing").

5. **Submit a Pull Request**:
   - Open a pull request on GitHub with a clear description of your changes and any related issues.
   - Await review and address feedback from maintainers.

## Tools and Workflows

- **Linters**: Use ESLint for TypeScript/JavaScript linting (`npm run lint` if configured).
- **Formatters**: Use Prettier for consistent formatting (`npm run format` if configured).
- **CI/CD**: If GitHub Actions are set up, ensure your changes pass automated checks.
- **HTMX**: The web interface uses HTMX for dynamic content loading. Familiarize yourself with attributes like `hx-get`, `hx-post`, and `hx-target`.

## Getting Help

- Open an issue on GitHub for questions, bugs, or feature requests.
- Contact maintainers via GitHub or other provided channels for guidance.
- Refer to the code comments and existing documentation for context on specific functionalities.

Thank you for contributing to the Tournament Management System! Your efforts help improve tournament management for Gaelic games enthusiasts.

---

This guide aligns with the project's structure and style, providing a comprehensive starting point for contributors. Let me know if you'd like to refine any section further or proceed to discuss usability improvements for the system!
