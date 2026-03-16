# Automated API tests (Tournament/Fixtures)

## Run

```bash
make test-api
```

Cleanup created data after test run:

```bash
make test-api CLEANUP=true
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

Story-based suites:

- `make test-api`: tournament-day flow
- `make test-api-pre-tournament`: pre-tournament admin/simulation flow
- `make test-api-championships`: series/championships flow
