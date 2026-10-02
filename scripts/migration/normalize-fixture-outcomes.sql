-- Do not run this file directly. Use:
--   npm run migrate:recent-schema -- --env=<acceptance|production> [--wet]
-- The runner validates existing values, serializes access, and is rerunnable.
-- This file remains as a concise schema record.

ALTER TABLE fixtures
  MODIFY outcome ENUM('played', 'in-progress', 'not played', 'skipped', 'conceded', 'forfeit') NULL DEFAULT 'not played';

UPDATE fixtures
SET outcome = CASE
  WHEN outcome IN ('conceded', 'forfeit') THEN 'skipped'
  WHEN outcome IS NULL
    AND goals1 IS NOT NULL AND points1 IS NOT NULL
    AND goals2 IS NOT NULL AND points2 IS NOT NULL THEN 'played'
  WHEN outcome IS NULL THEN 'not played'
  ELSE outcome
END;

ALTER TABLE fixtures
  MODIFY outcome ENUM('played', 'in-progress', 'not played', 'skipped') NOT NULL DEFAULT 'not played';
