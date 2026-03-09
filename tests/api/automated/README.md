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
- `suite.txt`: explicit ordered list of step files to execute
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

This suite is intentionally focused on the primary domain:
- tournaments
- squads
- fixture TSV validation/import
- fixture lifecycle (start, score, card, end)

Event/listing APIs should be covered by a separate suite.
