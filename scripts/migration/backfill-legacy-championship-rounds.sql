-- Optional legacy backfill. Run only after confirming that the legacy `rounds`
-- table exists. It does not change or delete legacy data.
--
-- A legacy round points to an entire tournament. This report identifies which
-- links have exactly one fixture competition and can therefore be backfilled
-- safely. Any row with competitionCount other than 1 needs manual assignment in
-- the portal after deployment.
SELECT r.id AS legacyRoundId, r.championshipId, r.roundNumber,
       r.eventId AS tournamentId, t.Title,
       COUNT(DISTINCT NULLIF(TRIM(f.category), '')) AS competitionCount,
       GROUP_CONCAT(DISTINCT NULLIF(TRIM(f.category), '')
         ORDER BY f.category SEPARATOR ', ') AS competitions
FROM rounds r
JOIN tournaments t ON t.id = r.eventId
LEFT JOIN fixtures f ON f.tournamentId = r.eventId
GROUP BY r.id, r.championshipId, r.roundNumber, r.eventId, t.Title
ORDER BY r.championshipId, r.roundNumber, r.eventId;

-- Run only after reviewing the preceding result. This statement is idempotent.
INSERT IGNORE INTO championship_competition_rounds
  (championshipId, roundNumber, tournamentId, competition)
SELECT r.championshipId, r.roundNumber, r.eventId, MIN(TRIM(f.category))
FROM rounds r
JOIN fixtures f ON f.tournamentId = r.eventId
WHERE NULLIF(TRIM(f.category), '') IS NOT NULL
GROUP BY r.id, r.championshipId, r.roundNumber, r.eventId
HAVING COUNT(DISTINCT NULLIF(TRIM(f.category), '')) = 1;
