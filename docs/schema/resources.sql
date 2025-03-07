CREATE TABLE `pitches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pitch` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `type` enum('grass','astro') DEFAULT NULL,
  `tournamentId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_tournamentId` (`tournamentId`),
  CONSTRAINT `fk_tournamentId` FOREIGN KEY (`tournamentId`) REFERENCES `tournaments` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `squads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teamName` varchar(255) DEFAULT NULL,
  `teamSheetSubmitted` tinyint(1) DEFAULT NULL,
  `notes` text,
  `groupLetter` varchar(1) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `tournamentId` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `clubTeams` (
  `teamId` int NOT NULL AUTO_INCREMENT,
  `clubId` int DEFAULT NULL,
  `teamName` varchar(255) DEFAULT NULL,
  `category` enum('gaa','lgfa','hurling','camogie','handball','rounders','youthfootball','youthhurling') DEFAULT NULL,
  `foundedYear` year DEFAULT NULL,
  `status` enum('active','inactive','unknown') DEFAULT NULL,
  `headCoach` varchar(255) DEFAULT NULL,
  `contactEmail` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`teamId`),
  KEY `clubId` (`clubId`),
  CONSTRAINT `clubTeams_ibfk_1` FOREIGN KEY (`clubId`) REFERENCES `clubs` (`clubId`)
) ENGINE=InnoDB;

CREATE TABLE `clubs` (
  `clubId` int NOT NULL AUTO_INCREMENT,
  `isStudent` varchar(3) DEFAULT NULL,
  `clubName` varchar(100) DEFAULT NULL,
  `clubLogo` blob,
  `founded` year DEFAULT NULL,
  `affiliated` year DEFAULT NULL,
  `deactivated` year DEFAULT NULL,
  `street_address` varchar(255) DEFAULT NULL,
  `post_code` varchar(20) DEFAULT NULL,
  `country` char(2) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  `region` varchar(50) DEFAULT NULL,
  `subregion` varchar(50) DEFAULT NULL,
  `status` char(1) DEFAULT NULL,
  `domain` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`clubId`)
) ENGINE=InnoDB;


