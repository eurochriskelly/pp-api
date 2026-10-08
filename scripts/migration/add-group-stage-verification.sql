ALTER TABLE tournaments
  ADD COLUMN verifyGroupStages BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN groupStageVerificationHashes JSON DEFAULT NULL;
