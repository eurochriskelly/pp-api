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

