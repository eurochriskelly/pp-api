#!/usr/bin/env node

/*
 * Imports the reviewed public GGE calendar bundle into the local EuroTourno
 * database. It is dry-run by default. --apply changes only the local database
 * selected with --local-docker; it never uses a production host.
 */
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');
const defaultBundle = path.resolve(
  root,
  '../pp-coord-responsive/data-imports/gge-2026'
);
const args = new Set(process.argv.slice(2));
const bundleArg = process.argv.find((value) => value.startsWith('--bundle='));
const bundle = bundleArg
  ? path.resolve(process.cwd(), bundleArg.slice('--bundle='.length))
  : defaultBundle;
const apply = args.has('--apply');
const localDocker = args.has('--local-docker');

if (apply && !localDocker) {
  throw new Error('--apply requires --local-docker to prevent remote imports.');
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(bundle, filename), 'utf8'));
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function cityFromLocation(location) {
  if (!location) return null;
  const city = String(location).split(',')[0].trim();
  return city || null;
}

function imageBuffer(relativePath) {
  if (!relativePath) return null;
  const filename = path.resolve(bundle, relativePath);
  if (!filename.startsWith(`${bundle}${path.sep}`)) {
    throw new Error(`Asset path escapes bundle: ${relativePath}`);
  }
  return fs.readFileSync(filename);
}

function sourceUuid(sourceId) {
  const hex = crypto.createHash('sha256').update(`gge:${sourceId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function primarySport(sports) {
  const first = Array.isArray(sports) ? sports[0] : sports;
  const mapped = {
    Mens_Football: 'Gaelic Football',
    mensFootball: 'Gaelic Football',
    LGFA: 'Ladies Football',
    lgfa: 'Ladies Football',
    Hurling: 'Hurling',
    Camogie: 'Camogie',
    Handball: 'Handball',
    Youth: 'Youth',
    G4MO: 'G4MO',
    OVER_35S: 'Over 35s',
    DADS_AND_LADS: 'Dads & Lads',
  };
  return mapped[String(first || '').replace(/ /g, '_')] || 'Gaelic Games';
}

function explicitRound(event) {
  const text = `${event.title || ''}\n${event.description || ''}`;
  const numeric = text.match(/\b(?:round|manche|journ[ée]e)\s*(\d+)\b/i);
  if (numeric) return Number(numeric[1]);
  if (/\b(?:preliminary|1st round|first round)\b/i.test(text)) return 1;
  if (/\b(?:quarter[ -]?final|qf)\b/i.test(text)) return 2;
  if (/\b(?:semi[ -]?final|\bsf\b)\b/i.test(text)) return 3;
  if (/\b(?:finals?|finishes)\b/i.test(text)) return 4;
  return null;
}

function buildHierarchy(events) {
  const fixtureDescriptions = new Map();
  for (const event of events) {
    const description = String(event.description || '').trim();
    if (event.event_type === 'FIXTURE' && description) {
      fixtureDescriptions.set(description, (fixtureDescriptions.get(description) || 0) + 1);
    }
  }
  const competitionEvents = events.filter((event) =>
    event.event_type === 'FIXTURE' && fixtureDescriptions.get(String(event.description || '').trim()) >= 2
  );
  const bySeries = new Map();
  for (const event of competitionEvents) {
    const seriesName = String(event.description).trim();
    if (!bySeries.has(seriesName)) bySeries.set(seriesName, []);
    bySeries.get(seriesName).push(event);
  }
  const result = new Map();
  for (const [seriesName, groupedEvents] of bySeries) {
    const dates = [...new Set(groupedEvents.map((event) => event.start_date.slice(0, 10)))].sort();
    const dateRound = new Map(dates.map((date, index) => [date, index + 1]));
    const season = /\b(20\d{2})(?:\/(\d{2}))?\b/.exec(seriesName);
    const championshipName = season ? `${seriesName} season` : `${seriesName} 2026`;
    const normalizedSports = [...new Set(groupedEvents.flatMap((event) => event.sports || []).map(primarySport))];
    const series = {
      sourceKey: `fixture-description:${seriesName}`,
      name: seriesName,
      championshipName,
      year: season ? Number(season[1]) : 2026,
      sport: normalizedSports.length === 1 ? normalizedSports[0] : null,
      numRounds: Math.max(...groupedEvents.map((event) => explicitRound(event) || dateRound.get(event.start_date.slice(0, 10)))),
    };
    for (const event of groupedEvents) {
      result.set(event.source_id, {
        series,
        roundNumber: explicitRound(event) || dateRound.get(event.start_date.slice(0, 10)),
        competition: primarySport(event.sports),
      });
    }
  }
  return result;
}

async function ensureSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS gge_import_runs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      sourceSha256 CHAR(64) NOT NULL,
      sourceUrl VARCHAR(1024) NOT NULL,
      fetchedAtUtc DATETIME NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_gge_import_runs_source (sourceSha256)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS gge_import_clubs (
      sourceId VARCHAR(64) NOT NULL,
      clubId INT NOT NULL,
      runId BIGINT NOT NULL,
      sourceName VARCHAR(255) NOT NULL,
      payload JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (sourceId),
      KEY ix_gge_import_clubs_club (clubId),
      CONSTRAINT fk_gge_import_clubs_club FOREIGN KEY (clubId) REFERENCES clubs(clubId),
      CONSTRAINT fk_gge_import_clubs_run FOREIGN KEY (runId) REFERENCES gge_import_runs(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS gge_import_series (
      sourceKey VARCHAR(512) NOT NULL,
      seriesId INT NOT NULL,
      runId BIGINT NOT NULL,
      payload JSON NOT NULL,
      PRIMARY KEY (sourceKey),
      KEY ix_gge_import_series_series (seriesId),
      CONSTRAINT fk_gge_import_series_series FOREIGN KEY (seriesId) REFERENCES series(id),
      CONSTRAINT fk_gge_import_series_run FOREIGN KEY (runId) REFERENCES gge_import_runs(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS gge_import_championships (
      sourceKey VARCHAR(512) NOT NULL,
      championshipId INT NOT NULL,
      runId BIGINT NOT NULL,
      payload JSON NOT NULL,
      PRIMARY KEY (sourceKey),
      KEY ix_gge_import_championships_championship (championshipId),
      CONSTRAINT fk_gge_import_championships_championship FOREIGN KEY (championshipId) REFERENCES championships(id),
      CONSTRAINT fk_gge_import_championships_run FOREIGN KEY (runId) REFERENCES gge_import_runs(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS gge_import_events (
      sourceId VARCHAR(64) NOT NULL,
      tournamentId INT NOT NULL,
      clubId INT NULL,
      seriesId INT NULL,
      championshipId INT NULL,
      runId BIGINT NOT NULL,
      payload JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (sourceId),
      KEY ix_gge_import_events_tournament (tournamentId),
      KEY ix_gge_import_events_championship (championshipId),
      CONSTRAINT fk_gge_import_events_tournament FOREIGN KEY (tournamentId) REFERENCES tournaments(id),
      CONSTRAINT fk_gge_import_events_club FOREIGN KEY (clubId) REFERENCES clubs(clubId),
      CONSTRAINT fk_gge_import_events_series FOREIGN KEY (seriesId) REFERENCES series(id),
      CONSTRAINT fk_gge_import_events_championship FOREIGN KEY (championshipId) REFERENCES championships(id),
      CONSTRAINT fk_gge_import_events_run FOREIGN KEY (runId) REFERENCES gge_import_runs(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const [columns] = await connection.query("SHOW COLUMNS FROM clubs LIKE 'clubLogo'");
  if (!columns.length) throw new Error('EuroTourno.clubs.clubLogo is required.');
  if (String(columns[0].Type).toLowerCase() === 'blob') {
    await connection.query('ALTER TABLE clubs MODIFY clubLogo MEDIUMBLOB NULL');
  }
}

async function findOrCreateRun(connection, manifest) {
  const [existing] = await connection.query(
    'SELECT id FROM gge_import_runs WHERE sourceSha256 = ?',
    [manifest.source_sha256]
  );
  if (existing[0]) return existing[0].id;
  const [result] = await connection.query(
    'INSERT INTO gge_import_runs (sourceSha256, sourceUrl, fetchedAtUtc) VALUES (?, ?, ?)',
    [manifest.source_sha256, manifest.source_url, manifest.fetched_at_utc.replace('T', ' ').replace('+00:00', '')]
  );
  return result.insertId;
}

async function importClub(connection, club, runId, summary) {
  const [mapped] = await connection.query('SELECT clubId FROM gge_import_clubs WHERE sourceId = ?', [club.source_id]);
  if (mapped[0]) return mapped[0].clubId;
  const [candidates] = await connection.query(
    'SELECT clubId, clubName, country, city, clubLogo FROM clubs WHERE LOWER(clubName) = LOWER(?)',
    [club.name]
  );
  const country = club.country_code_iso2 || null;
  const city = cityFromLocation(club.location);
  const exactCountry = candidates.filter((candidate) => country && candidate.country === country);
  const exactCity = exactCountry.filter((candidate) => city && normalize(candidate.city) === normalize(city));
  const candidate = exactCity.length === 1 ? exactCity[0] : exactCountry.length === 1 ? exactCountry[0] : candidates.length === 1 ? candidates[0] : null;
  const logo = imageBuffer(club.logo_path);
  let clubId;
  if (candidate) {
    clubId = candidate.clubId;
    if (!candidate.clubLogo && logo) {
      await connection.query('UPDATE clubs SET clubLogo = ? WHERE clubId = ?', [logo, clubId]);
      summary.logosLoaded += 1;
    }
    summary.clubsMatched += 1;
  } else {
    const [inserted] = await connection.query(
      `INSERT INTO clubs (clubName, clubLogo, country, city, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [club.name, logo, country, city]
    );
    clubId = inserted.insertId;
    summary.clubsCreated += 1;
    if (logo) summary.logosLoaded += 1;
  }
  await connection.query(
    'INSERT INTO gge_import_clubs (sourceId, clubId, runId, sourceName, payload) VALUES (?, ?, ?, ?, ?)',
    [club.source_id, clubId, runId, club.name, JSON.stringify(club)]
  );
  return clubId;
}

async function findOrCreateHierarchy(connection, definition, runId, cache, summary) {
  if (!definition) return { seriesId: null, championshipId: null };
  if (cache.has(definition.series.sourceKey)) return cache.get(definition.series.sourceKey);
  const seriesKey = definition.series.sourceKey;
  const championshipKey = `${seriesKey}:championship:${definition.series.year}:${definition.series.championshipName}`;
  const [mappedSeries] = await connection.query('SELECT seriesId FROM gge_import_series WHERE sourceKey = ?', [seriesKey]);
  let seriesId = mappedSeries[0] && mappedSeries[0].seriesId;
  if (seriesId) {
    const [current] = await connection.query('SELECT sport FROM series WHERE id = ?', [seriesId]);
    if (current[0] && current[0].sport === 'Gaelic Games' && definition.series.sport) {
      await connection.query('UPDATE series SET sport = ? WHERE id = ?', [definition.series.sport, seriesId]);
    }
  }
  if (!seriesId) {
    const [existing] = await connection.query('SELECT id FROM series WHERE name = ? ORDER BY id LIMIT 2', [definition.series.name]);
    if (existing.length > 1) throw new Error(`Ambiguous existing series: ${definition.series.name}`);
    if (existing[0]) seriesId = existing[0].id;
    else {
      const [inserted] = await connection.query(
        `INSERT INTO series (name, description, sport, defaultSquadSize, defaultPlayersPerTeam, status)
         VALUES (?, ?, ?, 15, 15, 'active')`,
        [definition.series.name, `Imported from GGE public calendar (${seriesKey})`, definition.series.sport]
      );
      seriesId = inserted.insertId;
      summary.seriesCreated += 1;
    }
    await connection.query('INSERT INTO gge_import_series (sourceKey, seriesId, runId, payload) VALUES (?, ?, ?, ?)', [seriesKey, seriesId, runId, JSON.stringify(definition.series)]);
  }
  const [mappedChampionship] = await connection.query('SELECT championshipId FROM gge_import_championships WHERE sourceKey = ?', [championshipKey]);
  let championshipId = mappedChampionship[0] && mappedChampionship[0].championshipId;
  if (!championshipId) {
    const [existing] = await connection.query(
      'SELECT id FROM championships WHERE seriesId = ? AND year = ? AND name = ?',
      [seriesId, definition.series.year, definition.series.championshipName]
    );
    if (existing.length > 1) throw new Error(`Ambiguous existing championship: ${definition.series.championshipName}`);
    if (existing[0]) championshipId = existing[0].id;
    else {
      const [inserted] = await connection.query(
        `INSERT INTO championships (seriesId, name, year, numRounds, status)
         VALUES (?, ?, ?, ?, 'open')`,
        [seriesId, definition.series.championshipName, definition.series.year, definition.series.numRounds]
      );
      championshipId = inserted.insertId;
      summary.championshipsCreated += 1;
    }
    await connection.query('INSERT INTO gge_import_championships (sourceKey, championshipId, runId, payload) VALUES (?, ?, ?, ?)', [championshipKey, championshipId, runId, JSON.stringify(definition.series)]);
  }
  const value = { seriesId, championshipId };
  cache.set(seriesKey, value);
  return value;
}

async function runImport(connection, data) {
  const summary = { clubsCreated: 0, clubsMatched: 0, logosLoaded: 0, seriesCreated: 0, championshipsCreated: 0, tournamentsCreated: 0, roundsCreated: 0, skippedEvents: 0 };
  const hierarchy = buildHierarchy(data.events);
  const competitionEvents = [...hierarchy.keys()].length;
  if (!apply) {
    return { ...summary, sourceClubs: data.clubs.length, sourceEvents: data.events.length, competitionEvents, mode: 'dry-run' };
  }
  await ensureSchema(connection);
  await connection.beginTransaction();
  try {
    const runId = await findOrCreateRun(connection, data.manifest);
    const clubs = new Map();
    for (const club of data.clubs) clubs.set(club.source_id, await importClub(connection, club, runId, summary));
    const hierarchyCache = new Map();
    for (const definition of new Map([...hierarchy.values()].map((value) => [value.series.sourceKey, value])).values()) {
      await findOrCreateHierarchy(connection, definition, runId, hierarchyCache, summary);
    }
    for (const event of data.events) {
      const [mapped] = await connection.query('SELECT tournamentId FROM gge_import_events WHERE sourceId = ?', [event.source_id]);
      if (mapped[0]) { summary.skippedEvents += 1; continue; }
      const definition = hierarchy.get(event.source_id);
      const { seriesId, championshipId } = await findOrCreateHierarchy(connection, definition, runId, hierarchyCache, summary);
      const [inserted] = await connection.query(
        `INSERT INTO tournaments (Date, endDate, Title, Location, sport, region, season, eventUuid, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
        [event.start_date.slice(0, 10), event.end_date && event.end_date.slice(0, 10), event.title, event.location, primarySport(event.sports), event.region, Number(event.start_date.slice(0, 4)), sourceUuid(event.source_id)]
      );
      const tournamentId = inserted.insertId;
      await connection.query(
        `INSERT INTO gge_import_events (sourceId, tournamentId, clubId, seriesId, championshipId, runId, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [event.source_id, tournamentId, clubs.get(event.club_source_id) || null, seriesId, championshipId, runId, JSON.stringify(event)]
      );
      summary.tournamentsCreated += 1;
      if (definition) {
        await connection.query('INSERT IGNORE INTO tournament_competitions (tournamentId, name) VALUES (?, ?)', [tournamentId, definition.competition]);
        const [round] = await connection.query(
          `INSERT IGNORE INTO championship_competition_rounds
           (championshipId, roundNumber, tournamentId, competition) VALUES (?, ?, ?, ?)`,
          [championshipId, definition.roundNumber, tournamentId, definition.competition]
        );
        summary.roundsCreated += round.affectedRows;
      }
    }
    await connection.commit();
    return { ...summary, sourceClubs: data.clubs.length, sourceEvents: data.events.length, competitionEvents, runId, mode: 'applied' };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(bundle)) throw new Error(`Bundle not found: ${bundle}`);
  const data = {
    manifest: readJson('manifest.json'),
    clubs: readJson('normalized/clubs.json'),
    events: readJson('normalized/events.json'),
  };
  const hierarchy = buildHierarchy(data.events);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', sourceClubs: data.clubs.length, sourceEvents: data.events.length, competitionEvents: hierarchy.size, series: new Set([...hierarchy.values()].map((value) => value.series.sourceKey)).size, note: 'Run with --apply --local-docker to import only into the local Docker MySQL database.' }, null, 2));
    return;
  }
  const password = childProcess.execFileSync('docker', ['exec', 'mysql', 'sh', '-lc', 'printf %s "$MYSQL_ROOT_PASSWORD"'], { encoding: 'utf8' });
  const connection = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password, database: 'EuroTourno', charset: 'utf8mb4' });
  try {
    const summary = await runImport(connection, data);
    const [counts] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM gge_import_clubs) AS mappedClubs,
        (SELECT COUNT(*) FROM gge_import_events) AS mappedEvents,
        (SELECT COUNT(*) FROM gge_import_series) AS mappedSeries,
        (SELECT COUNT(*) FROM gge_import_championships) AS mappedChampionships,
        (SELECT COUNT(*) FROM championship_competition_rounds r JOIN gge_import_events e ON e.tournamentId = r.tournamentId) AS mappedRounds
    `);
    console.log(JSON.stringify({ ...summary, verification: counts[0] }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`[gge-import] ${error.message}`);
  process.exitCode = 1;
});
