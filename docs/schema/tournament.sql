CREATE TABLE `tournaments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `Date` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `Title` varchar(255) DEFAULT NULL,
  `Location` varchar(255) DEFAULT NULL,
  `Lat` float DEFAULT NULL,
  `Lon` float DEFAULT NULL,
  `code` varchar(4) DEFAULT '0000',
  `eventUuid` char(36) DEFAULT NULL,
   `status` enum('new','in-design','published','started','on-hold','closed') DEFAULT 'new',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `players` (
  `id` int NOT NULL AUTO_INCREMENT,
  `firstName` varchar(255) DEFAULT NULL,
  `secondName` varchar(255) DEFAULT NULL,
  `dateOfBirth` date DEFAULT NULL,
  `foirreannId` varchar(255) DEFAULT NULL,
  `teamId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `teamId` (`teamId`),
  CONSTRAINT `fk_players_squad` FOREIGN KEY (`teamId`) REFERENCES `squads` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `fixtures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournamentId` int DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `groupNumber` int DEFAULT NULL,
  `stage` varchar(255) DEFAULT NULL,
  `pitchPlanned` varchar(255) DEFAULT NULL,
  `pitch` varchar(255) DEFAULT NULL,
  `scheduledPlanned` datetime DEFAULT NULL,
  `scheduled` datetime DEFAULT NULL,
  `started` timestamp NULL DEFAULT NULL,
  `ended` datetime DEFAULT NULL,
  `team1Planned` varchar(255) DEFAULT NULL,
  `team1Id` varchar(255) DEFAULT NULL,
  `goals1` int DEFAULT NULL,
  `goals1Extra` int DEFAULT NULL,
  `goals1Penalties` int DEFAULT NULL,
  `points1` int DEFAULT NULL,
  `points1Extra` int DEFAULT NULL,
  `team2Planned` varchar(255) DEFAULT NULL,
  `team2Id` varchar(255) DEFAULT NULL,
  `goals2` int DEFAULT NULL,
  `goals2Extra` int DEFAULT NULL,
  `goals2Penalties` int DEFAULT NULL,
  `points2` int DEFAULT NULL,
  `points2Extra` int DEFAULT NULL,
  `umpireTeamPlanned` varchar(255) DEFAULT NULL,
  `umpireTeamId` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `outcome` enum('played','conceded','not played','forfeit') DEFAULT 'played',
  PRIMARY KEY (`id`),
  KEY `tournamentId` (`tournamentId`),
  CONSTRAINT `fixtures_ibfk_1` FOREIGN KEY (`tournamentId`) REFERENCES `tournaments` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournamentId` int DEFAULT NULL,
  `fixtureId` int DEFAULT NULL,
  `playerId` int DEFAULT NULL,
  `playerNumber` int DEFAULT NULL,
  `playerName` varchar(255) DEFAULT NULL,
  `cardColor` enum('yellow','red','black') DEFAULT NULL,
  `team` text,
  `updateTimestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_cards_tournament` (`tournamentId`),
  KEY `fk_cards_fixture` (`fixtureId`),
  KEY `fk_cards_player` (`playerId`),
  CONSTRAINT `fk_cards_fixture` FOREIGN KEY (`fixtureId`) REFERENCES `fixtures` (`id`),
  CONSTRAINT `fk_cards_player` FOREIGN KEY (`playerId`) REFERENCES `players` (`id`),
  CONSTRAINT `fk_cards_tournament` FOREIGN KEY (`tournamentId`) REFERENCES `tournaments` (`id`)
) ENGINE=InnoDB;

-- Intake forms (header)
CREATE TABLE IF NOT EXISTS intake_forms (
  intake_id      BIGINT NOT NULL AUTO_INCREMENT,
  event_uuid     CHAR(36) NOT NULL,
  club_id        INT NOT NULL,
  club_name      VARCHAR(200) NOT NULL,
  team_full_name VARCHAR(200) NOT NULL,
  event          VARCHAR(200) NOT NULL,
  start_date     DATE NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (intake_id),
  KEY ix_intake_event (event_uuid),
  KEY ix_intake_club (club_id),
  KEY ix_intake_event_club_team_date (event_uuid, club_id, team_full_name, start_date),
  CONSTRAINT fk_intake_forms_club
    FOREIGN KEY (club_id) REFERENCES clubs(clubId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Intake people (rows)
CREATE TABLE IF NOT EXISTS intake_people (
  id                     BIGINT NOT NULL AUTO_INCREMENT,
  intake_id              BIGINT NOT NULL,
  people_full_name       VARCHAR(200) NOT NULL,
  people_date_of_birth   DATE NULL,
  people_role            ENUM('player','manager','chairman','secretary') NOT NULL,
  external_id            BIGINT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_intake_people_form (intake_id),
  KEY ix_people_role (people_role),
  KEY ix_external_id (external_id),
  CONSTRAINT fk_intake_people_form
    FOREIGN KEY (intake_id) REFERENCES intake_forms(intake_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

