CREATE VIEW `v_categories` AS 
SELECT tournamentId, category, 
COALESCE(MAX(CASE WHEN currentGame > 0 THEN stage END), 'group') AS latestStage,
SUM(totalGames) AS totalGames, SUM(currentGame) AS currentGame,
GROUP_CONCAT(DISTINCT brackets ORDER BY brackets ASC SEPARATOR ', ') AS brackets
FROM (
  SELECT tournamentId, category, stage, 
  COUNT(*) AS totalGames, SUM(CASE WHEN started IS NOT NULL THEN 1 ELSE 0 END) AS currentGame,
  GROUP_CONCAT(DISTINCT CASE WHEN stage IN ('playoffs','finals','semis','runnerup','quarters','eights') THEN 'cup' 
                            WHEN stage = 'group' THEN 'plate' ELSE 'shield' END ORDER BY stage ASC SEPARATOR ', ') AS brackets
  FROM fixtures 
  GROUP BY tournamentId, category, stage
) AS detailed 
GROUP BY tournamentId, category 
ORDER BY tournamentId, category;

CREATE VIEW `v_club_matrix` AS 
SELECT c.clubId, c.clubName, c.country, c.city, c.region, c.subregion,
MAX(CASE WHEN ct.category = 'gaa' THEN 1 ELSE 0 END) AS gaa,
MAX(CASE WHEN ct.category = 'lgfa' THEN 1 ELSE 0 END) AS lgfa,
MAX(CASE WHEN ct.category = 'hurling' THEN 1 ELSE 0 END) AS hurling,
MAX(CASE WHEN ct.category = 'camogie' THEN 1 ELSE 0 END) AS camogie,
MAX(CASE WHEN ct.category = 'handball' THEN 1 ELSE 0 END) AS handball,
MAX(CASE WHEN ct.category = 'rounders' THEN 1 ELSE 0 END) AS rounders,
MAX(CASE WHEN ct.category = 'youthfootball' THEN 1 ELSE 0 END) AS youthfootball,
MAX(CASE WHEN ct.category = 'youthhurling' THEN 1 ELSE 0 END) AS youthhurling
FROM clubs c 
LEFT JOIN clubTeams ct ON c.clubId = ct.clubId 
GROUP BY c.clubId, c.clubName, c.post_code, c.country, c.city, c.region, c.subregion, c.status 
HAVING c.status = 'A';

CREATE VIEW `v_club_teams` AS 
SELECT c.clubId, c.clubName, c.post_code, c.country, c.city, c.region, c.subregion, c.status AS clubStatus, c.domain,
ct.teamId, ct.teamName, ct.category, ct.status AS teamStatus
FROM clubs c 
JOIN clubTeams ct ON c.clubId = ct.clubId;

CREATE VIEW `v_fixture_information` AS 
SELECT id, tournamentId, category, groupNumber, pitch, stage, scheduled, TIME_FORMAT(scheduled, '%H:%i') AS scheduledTime,
started, TIME_FORMAT(started, '%H:%i') AS startedTime, team1Id AS team1, goals1, points1, team2Id AS team2, goals2, points2,
umpireTeamId AS umpireTeam,
CASE WHEN goals1 IS NOT NULL AND points1 IS NOT NULL AND goals2 IS NOT NULL AND points2 IS NOT NULL THEN TRUE ELSE FALSE END AS played
FROM fixtures 
ORDER BY scheduled;
