# API overview

## Contributing guideines

Contributions should prioritize maintainability, small file sizes, and compatibility with LLMs for code generation and review. 

## Application architecture

The main entry points are `src/server.ts` (server bootstrap) and `src/api/index.ts` (API setup and route mounting). Routes are defined per resource under `src/api/routes/`, pass through `src/api/controllers/`, and finally call `src/api/services/` for business logic.

## Contribution Guidelines

1. **File Size**: Keep files small. Split large files into logical modules to reduce context size for LLMs.
2. **Refactoring**: 
   - Refactor repeated code into DRY functions on the fly. Even when not the core requirements, keep on making small improvements.
   - Compress context by consolidating logic into reusable utilities.
3. **Testability**: Write logic in functions to enable future unit tests, even if not currently maintained.
4. **Backend Integration**: Use existing complex logic (e.g., `src/import/` for fixtures) via the API.
5. **Testing with LLMs**: Test code before committing when working with LLMs.
6. **Documentation**: 
   - Changes to the database SCHEMA must be reflected in the relevant `docs/schema/*.sql`
   - Changes to the API must be reflected in the relevant `docs/api/*.yaml` document
   
## MySql backend

This API connects to a MySQL backend using the `mysql2` package. The schema can be found in `docs/schema/`.
At this pre-release stage, prefer schema changes over adding complex logic in the services layer.

## Further reading

- `docs/architecture-overview.md` — current architecture and conventions.
- `docs/tasks/architecture-hardening-plan.md` — resumable improvement plan.
- `AGENTS.md` — agent/developer commands and patterns.
