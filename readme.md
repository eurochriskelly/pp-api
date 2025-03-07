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
