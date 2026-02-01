const dbHelper = require('../../lib/db-helper');
const { v4: uuidv4 } = require('uuid');

function mapEventToApi(dbEvent) {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    startDate: dbEvent.start_date,
    endDate: dbEvent.end_date,
    location: dbEvent.location,
    region: dbEvent.region,
    imageUrl: dbEvent.image_url,
    organizerId: dbEvent.organizer_id,
    sports: dbEvent.sports || [],
  };
}

function mapListingToApi(dbListing) {
  let heroConfig = dbListing.hero_config;
  // If it's a string (e.g. stored as TEXT or returned as string), parse it
  if (typeof heroConfig === 'string') {
    try {
      heroConfig = JSON.parse(heroConfig);
    } catch {
      // If parsing fails, return as is or null.
      // Given the requirement is a JSON object, we might want to ensure it's one,
      // but if the DB has bad data, better not to crash.
    }
  }

  return {
    id: dbListing.id,
    title: dbListing.title,
    slug: dbListing.slug,
    description: dbListing.description,
    heroConfig,
    createdBy: dbListing.created_by,
    eventIds: dbListing.event_ids || [],
    events: dbListing.events || undefined,
  };
}

module.exports = (dbs) => {
  const dbClub = dbs.club || dbs;
  const dbMain = dbs.main;

  const {
    select,
    insert,
    update,
    delete: remove,
    transaction,
  } = dbHelper(dbClub);

  // Helper to sync user from Main DB to Club DB
  const syncUser = async (userId) => {
    if (!dbMain) return;

    const existing = await select('SELECT id FROM Users WHERE id = ?', [
      userId,
    ]);
    if (existing.length > 0) return;

    const { select: selectMain } = dbHelper(dbMain);
    const users = await selectMain(
      `SELECT u.id, u.Email, u.Name, r.RoleName as Role 
       FROM sec_users u 
       LEFT JOIN sec_roles r ON u.id = r.UserId 
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      throw new Error(`User ${userId} not found in main database.`);
    }
    const user = users[0];

    const role =
      user.Role && user.Role.toLowerCase() === 'admin' ? 'admin' : 'organizer';

    await insert(
      'INSERT INTO Users (id, name, email, role) VALUES (?, ?, ?, ?)',
      [user.id, user.Name, user.Email, role]
    );
  };

  const getListing = async (idOrSlug, expandEvents = false) => {
    let listing = null;
    let listings = [];
    if (idOrSlug.startsWith('lst_')) {
      listings = await select('SELECT * FROM Listings WHERE id = ?', [
        idOrSlug,
      ]);
    } else {
      listings = await select('SELECT * FROM Listings WHERE slug = ?', [
        idOrSlug,
      ]);
    }

    if (!listings.length) return null;
    listing = listings[0];

    const eventRows = await select(
      'SELECT event_id FROM ListingEvents WHERE listing_id = ?',
      [listing.id]
    );
    listing.event_ids = eventRows.map((r) => r.event_id);

    if (expandEvents && listing.event_ids.length > 0) {
      const placeholders = listing.event_ids.map(() => '?').join(',');
      const events = await select(
        `SELECT * FROM Events WHERE id IN (${placeholders})`,
        listing.event_ids
      );

      // Populate sports for these events
      for (const evt of events) {
        const sports = await select(
          `SELECT s.name as sport 
             FROM EventSports es
             JOIN Sports s ON es.sport_id = s.id
             WHERE es.event_id = ?`,
          [evt.id]
        );
        evt.sports = sports.map((s) => s.sport);
      }

      listing.events = events.map(mapEventToApi);
    }

    return mapListingToApi(listing);
  };

  const getListingEvents = async (idOrSlug, filters) => {
    let listingId = null;
    if (idOrSlug.startsWith('lst_')) {
      const rows = await select('SELECT id FROM Listings WHERE id = ?', [
        idOrSlug,
      ]);
      if (rows.length) listingId = rows[0].id;
    } else {
      const rows = await select('SELECT id FROM Listings WHERE slug = ?', [
        idOrSlug,
      ]);
      if (rows.length) listingId = rows[0].id;
    }

    if (!listingId) return null;

    let query = `
      SELECT e.* 
      FROM Events e
      JOIN ListingEvents le ON e.id = le.event_id
      WHERE le.listing_id = ?
    `;
    const params = [listingId];

    // Filters
    // 1. Search (Title/Description)
    if (filters.search) {
      query += ` AND (e.title LIKE ? OR e.description LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // 2. Sport (Join EventSports)
    if (filters.sport) {
      // Handle array or string
      const sports = Array.isArray(filters.sport)
        ? filters.sport
        : [filters.sport];
      if (sports.length > 0) {
        // We need events that have ANY of the sports.
        // DISTINCT to avoid duplicates if an event has multiple matching sports
        // We need to modify the main query to join, or use EXISTS. EXISTS is safer to avoid duplicates in result.
        // But since we are selecting e.*, let's use a subquery or join.
        // "SELECT e.* FROM Events e JOIN ListingEvents ... WHERE ... AND EXISTS (SELECT 1 FROM EventSports es JOIN Sports s ON es.sport_id = s.id WHERE es.event_id = e.id AND s.name IN (?))"
        const placeholders = sports.map(() => '?').join(',');
        query += ` AND EXISTS (
          SELECT 1 FROM EventSports es 
          JOIN Sports s ON es.sport_id = s.id 
          WHERE es.event_id = e.id AND s.name IN (${placeholders})
        )`;
        params.push(...sports);
      }
    }

    // 3. Region
    if (filters.region) {
      query += ` AND e.region = ?`;
      params.push(filters.region);
    }

    // 4. Date Logic
    const { startDate, endDate, includePast } = filters;
    const hasDateRange = startDate || endDate;

    if (hasDateRange) {
      // Range query: return events occurring within this specific range.
      // e.start_date <= range_end AND e.end_date >= range_start
      // If only start provided: end >= range_start
      // If only end provided: start <= range_end
      // Wait, let's stick to user request: "return events occurring within this specific range"
      // If both provided:
      if (startDate && endDate) {
        // Events that overlap with the range [startDate, endDate]
        query += ` AND (e.end_date >= ? AND e.start_date <= ?)`;
        params.push(startDate, endDate);
      } else if (startDate) {
        // Events starting after startDate or ongoing
        query += ` AND e.end_date >= ?`;
        params.push(startDate);
      } else if (endDate) {
        // Events starting before endDate
        query += ` AND e.start_date <= ?`;
        params.push(endDate);
      }
    } else if (!includePast) {
      // Default behavior: end_date >= NOW() - 3 DAYS
      // We can use SQL NOW() or JS Date. JS Date is safer for timezone control if needed, but SQL is fine.
      // NOW() - INTERVAL 3 DAY
      query += ` AND e.end_date >= DATE_SUB(NOW(), INTERVAL 3 DAY)`;
    }
    // If includePast is true and no date range, we don't add any date filter (return all history)

    // Sort by start_date ascending (soonest first)
    query += ` ORDER BY e.start_date ASC`;

    const events = await select(query, params);

    // Populate sports
    for (const evt of events) {
      const sports = await select(
        `SELECT s.name as sport 
           FROM EventSports es
           JOIN Sports s ON es.sport_id = s.id
           WHERE es.event_id = ?`,
        [evt.id]
      );
      evt.sports = sports.map((s) => s.sport);
    }

    return events.map(mapEventToApi);
  };

  const getListingTimeline = async (idOrSlug) => {
    let listingId = null;
    if (idOrSlug.startsWith('lst_')) {
      const rows = await select('SELECT id FROM Listings WHERE id = ?', [
        idOrSlug,
      ]);
      if (rows.length) listingId = rows[0].id;
    } else {
      const rows = await select('SELECT id FROM Listings WHERE slug = ?', [
        idOrSlug,
      ]);
      if (rows.length) listingId = rows[0].id;
    }

    if (!listingId) return null;

    // We need counts by Year and Month
    // SQLite uses strftime, MySQL uses YEAR() / MONTH().
    // Assuming MySQL based on `ER_DUP_ENTRY` in controller and previous syntax.
    const query = `
      SELECT 
        YEAR(e.start_date) as year,
        MONTH(e.start_date) as month,
        COUNT(*) as count
      FROM Events e
      JOIN ListingEvents le ON e.id = le.event_id
      WHERE le.listing_id = ?
      GROUP BY YEAR(e.start_date), MONTH(e.start_date)
      ORDER BY year DESC, month DESC
    `;

    const rows = await select(query, [listingId]);

    // Transform to requested structure:
    // { "2024": { "count": 12, "months": { "01": 5, ... } } }

    const result = {};

    for (const row of rows) {
      const y = row.year;
      // Pad month to 2 digits "01", "02"
      const m = String(row.month).padStart(2, '0');
      const c = row.count;

      if (!result[y]) {
        result[y] = { count: 0, months: {} };
      }

      result[y].count += c;
      result[y].months[m] = c;
    }

    return result;
  };

  return {
    getListing,
    getListingEvents,
    getListingTimeline,

    listListings: async () => {
      const listings = await select('SELECT * FROM Listings');
      for (const lst of listings) {
        const eventRows = await select(
          'SELECT event_id FROM ListingEvents WHERE listing_id = ?',
          [lst.id]
        );
        lst.event_ids = eventRows.map((r) => r.event_id);
      }
      return listings.map(mapListingToApi);
    },

    createListing: async (data) => {
      const id = `lst_${uuidv4().split('-')[0]}`;
      const { title, slug, description, createdBy, eventIds, hero_config } =
        data;

      await syncUser(createdBy);

      // Ensure hero_config is a string if it's an object, for DB compatibility
      const heroConfigVal =
        hero_config && typeof hero_config === 'object'
          ? JSON.stringify(hero_config)
          : hero_config;

      await transaction(async () => {
        await insert(
          `INSERT INTO Listings (id, title, slug, description, created_by, hero_config) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, title, slug, description, createdBy, heroConfigVal]
        );

        if (eventIds && eventIds.length) {
          for (const eid of eventIds) {
            await insert(
              'INSERT INTO ListingEvents (listing_id, event_id) VALUES (?, ?)',
              [id, eid]
            );
          }
        }
      });

      return getListing(id);
    },

    updateListing: async (id, data) => {
      const { title, slug, description, eventIds, hero_config } = data;

      await transaction(async () => {
        const fields = [];
        const params = [];
        if (title !== undefined) {
          fields.push('title = ?');
          params.push(title);
        }
        if (slug !== undefined) {
          fields.push('slug = ?');
          params.push(slug);
        }
        if (description !== undefined) {
          fields.push('description = ?');
          params.push(description);
        }
        if (hero_config !== undefined) {
          fields.push('hero_config = ?');
          params.push(
            hero_config && typeof hero_config === 'object'
              ? JSON.stringify(hero_config)
              : hero_config
          );
        }

        if (fields.length) {
          params.push(id);
          await update(
            `UPDATE Listings SET ${fields.join(', ')} WHERE id = ?`,
            params
          );
        }

        if (eventIds) {
          await remove('DELETE FROM ListingEvents WHERE listing_id = ?', [id]);
          for (const eid of eventIds) {
            await insert(
              'INSERT INTO ListingEvents (listing_id, event_id) VALUES (?, ?)',
              [id, eid]
            );
          }
        }
      });

      return getListing(id);
    },

    deleteListing: async (id) => {
      await remove('DELETE FROM Listings WHERE id = ?', [id]);
    },
  };
};
