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

## Automated API tests

Run sequential API tests with:

```bash
make test-api
```

Optional cleanup:

```bash
make test-api CLEANUP=true
```

This command:
- runs sequential `.posting.yaml` steps from `tests/api/automated/steps/`
- loads variables from `tests/api/automated/common.env`
- stores per-step request/response artifacts under `tests/api/automated/artifacts/<timestamp>/`
- if `CLEANUP=true`, runs cleanup steps at the end to remove created test data
