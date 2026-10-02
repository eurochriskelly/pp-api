-- Add competition-level championship round assignments.
-- This is additive: it does not alter or delete the legacy rounds table.
--
-- Do not run this file directly. Use:
--   npm run migrate:recent-schema -- --env=<acceptance|production> [--wet]
-- The runner performs preflight checks, uses an advisory lock, and makes every
-- schema operation safe to rerun. This file remains as a concise schema record.

CREATE TABLE IF NOT EXISTS tournament_competitions (
  id INT NOT NULL AUTO_INCREMENT,
  tournamentId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tournament_competition_name (tournamentId, name),
  CONSTRAINT fk_tournament_competitions_tournament
    FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backfill the durable competition catalogue from existing fixtures.
-- Some older deployments have a separate teams table, while others do not;
-- fixture categories are the portable historical source.
INSERT IGNORE INTO tournament_competitions (tournamentId, name)
SELECT tournamentId, TRIM(category) FROM fixtures
WHERE tournamentId IS NOT NULL AND NULLIF(TRIM(category), '') IS NOT NULL;

CREATE TABLE IF NOT EXISTS championship_competition_rounds (
  id INT NOT NULL AUTO_INCREMENT,
  championshipId INT NOT NULL,
  roundNumber INT NOT NULL,
  tournamentId INT NOT NULL,
  competition VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_championship_competition_round
    (championshipId, roundNumber, tournamentId, competition),
  UNIQUE KEY uk_tournament_competition_championship_round
    (tournamentId, competition),
  KEY ix_championship_competition_rounds_championship (championshipId),
  CONSTRAINT fk_championship_competition_rounds_championship
    FOREIGN KEY (championshipId) REFERENCES championships(id) ON DELETE CASCADE,
  CONSTRAINT fk_championship_competition_rounds_tournament
    FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- If the legacy `rounds` table exists, review and backfill it with
-- backfill-legacy-championship-rounds.sql. It is intentionally separate because
-- some deployments never created that experimental table.
