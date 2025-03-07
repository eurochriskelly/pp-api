#!/bin/bash
id2=3076
id1=3076
curl -X POST http://localhost:4001/api/fixtures/${id2}/score \
     -H "Content-Type: application/json" \
     -d '{"team1": {"points": 1, "goals": 5}, "team2": {"points": 1, "goals": 40}}'

exit
curl -X POST http://localhost:4001/api/fixtures/${id1}/score \
     -H "Content-Type: application/json" \
     -d '{"team1": {"points": 1, "goals": 5}, "team2": {"points": 1, "goals": 40}}'
