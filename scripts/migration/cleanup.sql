-- CLEANUP: Remove all Den Haag Invitational championship data
-- Run this first to get back to clean state

SET FOREIGN_KEY_CHECKS = 0;

-- Delete all child records first
DELETE te FROM team_entrants te
JOIN tournament_teams tt ON te.tournamentTeamId = tt.id
JOIN championship_entrants ce ON tt.entrantId = ce.id
JOIN championships c ON ce.championshipId = c.id
JOIN series s ON c.seriesId = s.id
WHERE s.name LIKE 'Den Haag Invitational%';

DELETE ac FROM amalgamation_clubs ac
JOIN championship_entrants ce ON ac.entrantId = ce.id
JOIN championships c ON ce.championshipId = c.id
JOIN series s ON c.seriesId = s.id
WHERE s.name LIKE 'Den Haag Invitational%';

DELETE tt FROM tournament_teams tt
JOIN championship_entrants ce ON tt.entrantId = ce.id
JOIN championships c ON ce.championshipId = c.id
JOIN series s ON c.seriesId = s.id
WHERE s.name LIKE 'Den Haag Invitational%';

DELETE tc FROM tournament_championships tc
JOIN championships c ON tc.championshipId = c.id
JOIN series s ON c.seriesId = s.id
WHERE s.name LIKE 'Den Haag Invitational%';

-- Delete championship entrants
DELETE ce FROM championship_entrants ce
JOIN championships c ON ce.championshipId = c.id
JOIN series s ON c.seriesId = s.id
WHERE s.name LIKE 'Den Haag Invitational%';

-- Delete championships
DELETE c FROM championships c
JOIN series s ON c.seriesId = s.id
WHERE s.name LIKE 'Den Haag Invitational%';

-- Delete series
DELETE FROM series WHERE name LIKE 'Den Haag Invitational%';

-- Delete clubs created for this migration (region = 'Den Haag')
-- Only delete if they're not referenced by other championship_entrants
DELETE cl FROM clubs cl
LEFT JOIN championship_entrants ce ON cl.clubId = ce.clubId
WHERE cl.region = 'Den Haag'
  AND ce.id IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- Verify
SELECT 'Cleanup complete' as status,
  (SELECT COUNT(*) FROM series WHERE name LIKE 'Den Haag Invitational%') as series_remaining,
  (SELECT COUNT(*) FROM championship_entrants ce 
   JOIN championships c ON ce.championshipId = c.id 
   JOIN series s ON c.seriesId = s.id 
   WHERE s.name LIKE 'Den Haag Invitational%') as entrants_remaining;
