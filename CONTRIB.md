# API overview

## Contributing guideines

Contributions should prioritize maintainability, small file sizes, and compatibility with LLMs for code generation and review. 

## Application architecture

The main entry points is `api/index.js`. From there the 'routes' are defined mostly by table and go through 'controllers' and finally 'services'.

## Contribution Guidelines
1. **File Size**: Keep files small. Split large files into logical modules to reduce context size for LLMs.
2. **Refactoring**: 
   - Refactor repeated code into DRY functions on the fly. Even when not the core requirements, keep on making small improvements.
   - Compress context by consolidating logic into reusable utilities.
3. **Testability**: Write logic in functions to enable future unit tests, even if not currently maintained.
4. **Backend Integration**: Use existing complex logic (e.g., `src/import/` for fixtures) via the API.
5. **Testing with LLMs**: Test code before committing when working with LLMs.
   
## MySql backend

This API connects to a MySQL backend. The schema can be found in `docs/schema.sql`.
At this pre-release stage, prefer schema changes than adding complex logic in the services layer.

