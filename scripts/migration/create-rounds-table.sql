-- Migration: Extract championshipId/roundNumber from tournaments into dedicated rounds table
-- Database: EuroTourno
-- Date: 2026-04-26

-- Step 1: Create rounds table
CREATE TABLE IF NOT EXISTS rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  championshipId INT NOT NULL,
  roundNumber INT NOT NULL,
  eventId INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rounds_championship_round_event (championshipId, roundNumber, eventId),
  KEY fk_rounds_championship (championshipId),
  KEY fk_rounds_event (eventId),
  CONSTRAINT fk_rounds_championship FOREIGN KEY (championshipId) REFERENCES championships(id) ON DELETE CASCADE,
  CONSTRAINT fk_rounds_event FOREIGN KEY (eventId) REFERENCES tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Step 2: Migrate existing data from tournaments
-- Only 1 tournament (id=41) has championship data currently
INSERT INTO rounds (championshipId, roundNumber, eventId)
SELECT championshipId, COALESCE(roundNumber, 1), id
FROM tournaments
WHERE championshipId IS NOT NULL;

-- Step 3: Drop tournament_championships junction table (no meaningful data, only 2 rows)
-- NOTE: Only run this after confirming data is safe to discard
-- DROP TABLE IF EXISTS tournament_championships;

-- Step 4: Remove columns from tournaments (RUN ONLY AFTER CODE IS DEPLOYED)
-- ALTER TABLE tournaments DROP COLUMN championshipId, DROP COLUMN roundNumber;
