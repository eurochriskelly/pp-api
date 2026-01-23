DROP DATABASE IF EXISTS PPClubEvents;
CREATE DATABASE IF NOT EXISTS PPClubEvents;
USE PPClubEvents;

-- 1. Users Table
CREATE TABLE Users (
    id VARCHAR(50) PRIMARY KEY, -- Using VARCHAR to support string IDs from current system
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role ENUM('organizer', 'admin') NOT NULL DEFAULT 'organizer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Events Table
CREATE TABLE Events (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    organizer_id VARCHAR(50) NOT NULL,
    region VARCHAR(100), -- e.g., 'Leinster', 'Dublin'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES Users(id)
);

-- 3. Sports Table (Lookup for tags)
CREATE TABLE Sports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 4. EventSports (Many-to-Many Junction)
CREATE TABLE EventSports (
    event_id VARCHAR(50) NOT NULL,
    sport_id INT NOT NULL,
    PRIMARY KEY (event_id, sport_id),
    FOREIGN KEY (event_id) REFERENCES Events(id) ON DELETE CASCADE,
    FOREIGN KEY (sport_id) REFERENCES Sports(id) ON DELETE CASCADE
);

-- 5. Listings Table
CREATE TABLE Listings (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE, -- e.g., 'youth-events'
    description TEXT,
    created_by VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES Users(id)
);

-- 6. ListingEvents (Many-to-Many Junction)
CREATE TABLE ListingEvents (
    listing_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (listing_id, event_id),
    FOREIGN KEY (listing_id) REFERENCES Listings(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Events(id) ON DELETE CASCADE
);
