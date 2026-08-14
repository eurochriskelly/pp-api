# Project directory structure

backend/
├── server.js              # Entry point (minimal, unchanged)
├── config/
│   └── config.js          # dbConf (unchanged)
├── api/
│   ├── index.js           # New: Replaces api-setup.js, handles app setup and mounts routes
│   ├── routes/            # New: Route definitions
│   │   ├── tournaments.js # Tournament-specific routes
│   │   ├── fixtures.js    # Fixture-specific routes
│   │   ├── regions.js     # Region routes
│   │   ├── general.js     # General routes
│   │   └── auth.js        # Auth routes
│   ├── controllers/       # New: Business logic
│   │   ├── tournaments.js
│   │   ├── fixtures.js
│   │   ├── regions.js
│   │   ├── general.js
│   │   └── auth.js
│   ├── services/          # New: DB access and reusable logic
│   │   └── dbService.js   # DB helpers
│   └── mocks/             # Mock data (unchanged)
├── lib/
│   ├── logging.js         # Unchanged
│   └── utils.js           # Unchanged (jsonToCsv, sendXsls, etc.)

This repository uses [Task](https://taskfile.dev/) for development commands. If
`task` is not installed, install go-task by following the
[installation guide](https://taskfile.dev/installation/).

The command interface is grouped by responsibility:

```bash
task
```

Common commands:

```bash
task server:dev
task server:mock PORT=4000
task server:start ENV=acceptance PORT=4000
task test
task test:api STORY=tournament-day CLEANUP=true
task db:backup ENV=production
```

`server:start` refuses to terminate an unrelated process that already owns the
requested port. Stop a tracked application instance with
`task server:stop PORT=4000`; use `FORCE=true` only when you intentionally want
to reclaim a busy port.

For the full grouped reference, run `task`. Use `task --list-all` only when
inspecting lower-level Taskfile details.

## Automated API tests

Run sequential API tests with:

```bash
task test:api STORY=tournament-day
```

Optional cleanup:

```bash
task test:api STORY=tournament-day CLEANUP=true
```

This command:
- runs sequential `.posting.yaml` steps from `tests/api/automated/steps/`
- loads variables from `tests/api/automated/common.env`
- stores per-step request/response artifacts under `tests/api/automated/artifacts/<timestamp>/`
- if `CLEANUP=true`, runs cleanup steps at the end to remove created test data
