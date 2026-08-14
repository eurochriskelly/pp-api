# Automated API tests (Tournament/Fixtures)

## Run

```bash
task test:api STORY=tournament-day
```

Cleanup created data after test run:

```bash
task test:api STORY=tournament-day CLEANUP=true
```

## Files

- `common.env`: shared variables used by all test steps
- `suite.txt`: legacy default suite list
- `suites/*.txt`: story-based suite definitions
- `steps/*.posting.yaml`: sequential step files
- `artifacts/<timestamp>/`: request/response artifacts and summary for each run

## Step format

Each step supports:

- `name`
- `phase`: `setup` or `cleanup`
- `method`
- `path` or `url`
- `headers`
- `body`
- `expect.status`: number or list of accepted status codes
- `expect.json`: path checks
- `capture`: save response fields as variables for later steps
- `whenVars`: skip step unless all listed variables are populated (useful for cleanup)

Variables can be referenced as `$VAR_NAME`.

Story-based suites are selected with `STORY`:

- `task test:api STORY=tournament-day`: tournament-day flow
- `task test:api STORY=pre-tournament`: pre-tournament admin/simulation flow
- `task test:api STORY=championships`: series/championships flow
