CREATE TABLE IF NOT EXISTS `tournament_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_uuid` char(36) NOT NULL,
  `version` int DEFAULT NULL,
  `status` enum('draft','published') NOT NULL DEFAULT 'draft',
  `report_json` json NOT NULL,
  `created_by` int DEFAULT NULL,
  `published_by` int DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament_reports_event_version` (`event_uuid`, `version`),
  KEY `idx_tournament_reports_event_status` (`event_uuid`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
