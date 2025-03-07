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
  PRIMARY KEY (`id`),
  UNIQUE KEY `Email` (`Email`)
) ENGINE=InnoDB;
