CREATE TABLE IF NOT EXISTS ListingEvents (
  listing_id VARCHAR(50) NOT NULL,
  event_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (listing_id, event_id),
  FOREIGN KEY (listing_id) REFERENCES Listings(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES Events(id) ON DELETE CASCADE
);
