-- Invite-based registration for sec_users.
--
-- Do not run this file directly. Use:
--   npm run migrate:recent-schema -- --env=<acceptance|production> [--wet]
-- The runner performs preflight checks, uses an advisory lock, and makes every
-- schema operation safe to rerun. This file remains as a concise schema record.
ALTER TABLE sec_users
  ADD COLUMN PhoneNumber varchar(30) DEFAULT NULL,
  ADD COLUMN club_id int DEFAULT NULL,
  ADD COLUMN Verified tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN ManualVerificationRequired tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN LoginCodeHash varchar(100) DEFAULT NULL,
  ADD COLUMN InviteTokenHash varchar(128) DEFAULT NULL,
  ADD COLUMN InviteExpiresAt datetime DEFAULT NULL,
  ADD UNIQUE KEY ux_sec_users_phone (PhoneNumber),
  ADD KEY ix_sec_users_invite_token (InviteTokenHash),
  ADD CONSTRAINT fk_sec_users_club FOREIGN KEY (club_id) REFERENCES clubs (clubId);
