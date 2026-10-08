CREATE TABLE IF NOT EXISTS series_regions (
  seriesId INT NOT NULL,
  region VARCHAR(100) NOT NULL,
  subregion VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (seriesId, region, subregion),
  CONSTRAINT fk_series_regions_series
    FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
