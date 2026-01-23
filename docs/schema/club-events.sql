-- Database: PPClubEvents

CREATE TABLE IF NOT EXISTS Events (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATETIME,
  end_date DATETIME,
  location VARCHAR(255),
  region VARCHAR(100),
  image_url VARCHAR(255),
  organizer_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS EventSports (
  event_id VARCHAR(50) NOT NULL,
  sport VARCHAR(100) NOT NULL,
  PRIMARY KEY (event_id, sport),
  FOREIGN KEY (event_id) REFERENCES Events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Listings (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ListingEvents (
  listing_id VARCHAR(50) NOT NULL,
  event_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (listing_id, event_id),
  FOREIGN KEY (listing_id) REFERENCES Listings(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES Events(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX idx_events_organizer ON Events(organizer_id);
CREATE INDEX idx_events_dates ON Events(start_date, end_date);
CREATE INDEX idx_listings_slug ON Listings(slug);
