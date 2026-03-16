-- MIGRATION: Create championships from legacy teams data
-- Target: tournamentTempUuid = 'e326b60d-b1af-4d6b-864f-7e4dbbc626bb'
-- Creates: 2 series (GAA, LGFA), 2 championships, entrants per club per championship

-- =====================================================
-- STEP 0: Create junction table
-- =====================================================
CREATE TABLE IF NOT EXISTS tournament_championships (
  tournamentId INT NOT NULL,
  championshipId INT NOT NULL,
  roundNumber INT NOT NULL DEFAULT 1,
  PRIMARY KEY (tournamentId, championshipId),
  CONSTRAINT fk_tc_tournament FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_tc_championship FOREIGN KEY (championshipId) REFERENCES championships(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- STEP 1: Create Series for each competition
-- =====================================================
INSERT IGNORE INTO series (name, description, sport, defaultSquadSize, defaultPlayersPerTeam, status)
SELECT DISTINCT
  CONCAT('Den Haag Invitational - ', t.competition),
  CONCAT('Annual ', t.competition, ' championship series'),
  'football',
  15, 15, 'active'
FROM teams t
WHERE t.tournamentTempUuid = 'e326b60d-b1af-4d6b-864f-7e4dbbc626bb'
  AND t.competition IS NOT NULL;

-- =====================================================
-- STEP 2: Create Championship "18th annual" for each Series
-- =====================================================
INSERT IGNORE INTO championships (seriesId, name, year, numRounds, squadSize, playersPerTeam, status)
SELECT s.id, '18th annual', 2025, 1, 15, 15, 'open'
FROM series s
WHERE s.name LIKE 'Den Haag Invitational%';

-- =====================================================
-- STEP 3: Create Clubs from teams data (unique clubs only)
-- =====================================================
INSERT IGNORE INTO clubs (clubName, status, region)
SELECT DISTINCT
  COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.contributingClubs[0].name')),
    JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.managingClub'))
  ),
  'A', 'Den Haag'
FROM teams t
WHERE t.tournamentTempUuid = 'e326b60d-b1af-4d6b-864f-7e4dbbc626bb'
  AND t.contributingClubs IS NOT NULL;

-- =====================================================
-- STEP 4: Create Championship Entrants (one per unique club per championship)
-- =====================================================
-- First, get unique clubs per competition from teams
CREATE TEMPORARY TABLE temp_clubs_per_competition AS
SELECT DISTINCT
  t.competition,
  COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.contributingClubs[0].name')),
    JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.managingClub'))
  ) as club_name
FROM teams t
WHERE t.tournamentTempUuid = 'e326b60d-b1af-4d6b-864f-7e4dbbc626bb'
  AND t.contributingClubs IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.managingClub')) IS NOT NULL;

-- Now create one entrant per club per championship
INSERT IGNORE INTO championship_entrants (championshipId, entrantType, clubId, displayName, status)
SELECT DISTINCT
  c.id,
  'club',
  cl.clubId,
  cl.clubName,
  'active'
FROM temp_clubs_per_competition tcc
JOIN clubs cl ON cl.clubName = tcc.club_name
JOIN series s ON s.name = CONCAT('Den Haag Invitational - ', tcc.competition)
JOIN championships c ON c.seriesId = s.id AND c.name = '18th annual';

DROP TEMPORARY TABLE temp_clubs_per_competition;

-- =====================================================
-- STEP 5: Create Tournament Teams
-- =====================================================
INSERT IGNORE INTO tournament_teams (tournamentId, entrantId, teamName, teamType, squadSizeSubmitted)
SELECT DISTINCT
  t.tournamentId,
  ce.id,
  t.name,
  'primary',
  NULL
FROM teams t
JOIN clubs cl ON cl.clubName = COALESCE(
  JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.contributingClubs[0].name')),
  JSON_UNQUOTE(JSON_EXTRACT(t.contributingClubs, '$.managingClub'))
)
JOIN series s ON s.name = CONCAT('Den Haag Invitational - ', t.competition)
JOIN championships c ON c.seriesId = s.id AND c.name = '18th annual'
JOIN championship_entrants ce ON ce.championshipId = c.id AND ce.clubId = cl.clubId
WHERE t.tournamentTempUuid = 'e326b60d-b1af-4d6b-864f-7e4dbbc626bb'
  AND t.tournamentId IS NOT NULL;

-- =====================================================
-- STEP 6: Link Tournament to Championships
-- =====================================================
INSERT IGNORE INTO tournament_championships (tournamentId, championshipId, roundNumber)
SELECT DISTINCT
  t.tournamentId,
  c.id,
  1
FROM teams t
JOIN series s ON s.name = CONCAT('Den Haag Invitational - ', t.competition)
JOIN championships c ON c.seriesId = s.id AND c.name = '18th annual'
WHERE t.tournamentTempUuid = 'e326b60d-b1af-4d6b-864f-7e4dbbc626bb'
  AND t.tournamentId IS NOT NULL;

-- =====================================================
-- RESULTS
-- =====================================================
SELECT 'Migration Complete' as status;

SELECT 
  s.name as series,
  c.name as championship,
  COUNT(DISTINCT ce.id) as entrants,
  COUNT(DISTINCT tt.id) as teams
FROM series s
JOIN championships c ON c.seriesId = s.id
LEFT JOIN championship_entrants ce ON ce.championshipId = c.id
LEFT JOIN tournament_teams tt ON tt.entrantId = ce.id
WHERE s.name LIKE 'Den Haag Invitational%'
GROUP BY s.id, c.id;
