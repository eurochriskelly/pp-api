CREATE TABLE IF NOT EXISTS EventSports (
  event_id VARCHAR(50) NOT NULL,
  sport VARCHAR(100) NOT NULL,
  PRIMARY KEY (event_id, sport),
  FOREIGN KEY (event_id) REFERENCES Events(id) ON DELETE CASCADE
);
