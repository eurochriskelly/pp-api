CREATE TABLE `sec_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `UserId` int DEFAULT NULL,
  `RoleName` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sec_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `DateAdded` datetime DEFAULT CURRENT_TIMESTAMP,
  `Email` varchar(100) DEFAULT NULL,
  `Pass` varchar(100) DEFAULT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT NULL,
  `LastAuthenticated` datetime DEFAULT NULL,
  `PhoneNumber` varchar(30) DEFAULT NULL,
  `club_id` int DEFAULT NULL,
  `Verified` tinyint(1) NOT NULL DEFAULT 0,
  `ManualVerificationRequired` tinyint(1) NOT NULL DEFAULT 0,
  `LoginCodeHash` varchar(100) DEFAULT NULL,
  `InviteTokenHash` varchar(128) DEFAULT NULL,
  `InviteExpiresAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Email` (`Email`),
  UNIQUE KEY `ux_sec_users_phone` (`PhoneNumber`),
  KEY `ix_sec_users_invite_token` (`InviteTokenHash`),
  CONSTRAINT `fk_sec_users_club` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`clubId`)
) ENGINE=InnoDB;
