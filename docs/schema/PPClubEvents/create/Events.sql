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

CREATE INDEX idx_events_organizer ON Events(organizer_id);
CREATE INDEX idx_events_dates ON Events(start_date, end_date);
