# Agent Guidelines for pp-api

## Build/Lint/Test Commands

- **Build**: `npm run build` (TypeScript to dist/)
- **Start**: `npm run start` (production), `npm run dev` (watch mode)
- **Lint**: `npm run lint`, `npm run lint:fix`
- **Unit tests**: `npm run test:unit`, single test: `node --test path/to/test.spec.js`
- **API tests**: `npm run test:api`, interactive: `npm run interactive`
- **Make**: `make start env=acceptance`, `make mocks`, `make logs`

## Code Style Guidelines

- **Language**: TypeScript + CommonJS, target ES2020, strict: false
- **Formatting**: Prettier (single quotes, ES5 trailing commas, 2-space indent)
- **Naming**: camelCase vars/functions, lower-kebab-case files
- **Types**: Use interfaces/types, JSDoc comments
- **Imports**: Relative from src/, require() for CommonJS
- **Error handling**: try/catch, throw Error objects
- **Architecture**: Routes → Controllers → Services, keep files <200 lines
- **Database**: Prefer schema changes over service logic, use API not direct DB
- **Documentation**: Update docs/schema/_.sql for DB, docs/api/_.yaml for API changes

## API Documentation Maintenance

- **Auto-generation**: Run `node scripts/generate-api-docs.js` to regenerate docs from routes
- **Manual updates**: Edit individual YAML files in `docs/api/paths/{resource}/` for customizations
- **Build process**: `npm run api` generates docs, bundles, and serves HTML documentation at http://localhost:4444
- **JSDoc**: Add JSDoc comments to controller methods for better generated documentation
- **Schema references**: Use existing schemas in `docs/api/components/schemas/` for request/response bodies
- **Redocly version**: Uses `@redocly/cli@1.0.0` (pinned to avoid dependency conflicts)
