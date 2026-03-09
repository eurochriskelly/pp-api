import dbHelper from '../../lib/db-helper';
import { v4 as uuidv4 } from 'uuid';

interface DbEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  region: string;
  image_url: string;
  organizer_id: string;
  sports?: string[];
}

interface ApiEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  region: string;
  imageUrl: string;
  organizerId: string;
  sports: string[];
}

interface DbListing {
  id: string;
  title: string;
  slug: string;
  description: string;
  hero_config?: string;
  created_by: string;
  event_ids?: string[];
  events?: ApiEvent[];
}

interface ApiListing {
  id: string;
  title: string;
  slug: string;
  description: string;
  heroConfig?: any;
  createdBy: string;
  eventIds: string[];
  events?: ApiEvent[];
}

interface EventFilters {
  search?: string;
  sport?: string | string[];
  region?: string;
  startDate?: string;
  endDate?: string;
  includePast?: boolean;
}

function mapEventToApi(dbEvent: DbEvent): ApiEvent {
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

function mapListingToApi(dbListing: DbListing): ApiListing {
  let heroConfig = dbListing.hero_config;
  if (typeof heroConfig === 'string') {
    try {
      heroConfig = JSON.parse(heroConfig);
    } catch {
      // Parsing failed, keep as is
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
    events: dbListing.events,
  };
}

function listingsService(dbs: { club?: any; main?: any } | any) {
  const dbClub = dbs.club || dbs;
  const dbMain = dbs.main;

  const {
    select,
    insert,
    update,
    delete: remove,
    transaction,
  } = dbHelper(dbClub);

  const syncUser = async (userId: string) => {
    if (!dbMain) return;

    const existing = (await select('SELECT id FROM Users WHERE id = ?', [
      userId,
    ])) as unknown[];
    if (existing.length > 0) return;

    const { select: selectMain } = dbHelper(dbMain);
    const users = (await selectMain(
      `SELECT u.id, u.Email, u.Name, r.RoleName as Role 
       FROM sec_users u 
       LEFT JOIN sec_roles r ON u.id = r.UserId 
       WHERE u.id = ?`,
      [userId]
    )) as { id: string; Email: string; Name: string; Role: string }[];

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

  const getListing = async (
    idOrSlug: string,
    expandEvents = false
  ): Promise<ApiListing | null> => {
    let listing: DbListing | null = null;
    let listings: DbListing[] = [];
    if (idOrSlug.startsWith('lst_')) {
      listings = (await select('SELECT * FROM Listings WHERE id = ?', [
        idOrSlug,
      ])) as unknown as DbListing[];
    } else {
      listings = (await select('SELECT * FROM Listings WHERE slug = ?', [
        idOrSlug,
      ])) as unknown as DbListing[];
    }

    if (!listings.length) return null;
    listing = listings[0];

    const eventRows = (await select(
      'SELECT event_id FROM ListingEvents WHERE listing_id = ?',
      [listing.id]
    )) as { event_id: string }[];
    listing.event_ids = eventRows.map((r) => r.event_id);

    if (expandEvents && listing.event_ids.length > 0) {
      const placeholders = listing.event_ids.map(() => '?').join(',');
      const events = (await select(
        `SELECT * FROM Events WHERE id IN (${placeholders})`,
        listing.event_ids
      )) as unknown as DbEvent[];

      for (const evt of events) {
        const sports = (await select(
          `SELECT s.name as sport 
             FROM EventSports es
             JOIN Sports s ON es.sport_id = s.id
             WHERE es.event_id = ?`,
          [evt.id]
        )) as { sport: string }[];
        evt.sports = sports.map((s) => s.sport);
      }

      listing.events = events.map(mapEventToApi);
    }

    return mapListingToApi(listing);
  };

  const getListingEvents = async (
    idOrSlug: string,
    filters: EventFilters
  ): Promise<ApiEvent[] | null> => {
    let listingId: string | null = null;
    if (idOrSlug.startsWith('lst_')) {
      const rows = (await select('SELECT id FROM Listings WHERE id = ?', [
        idOrSlug,
      ])) as { id: string }[];
      if (rows.length) listingId = rows[0].id;
    } else {
      const rows = (await select('SELECT id FROM Listings WHERE slug = ?', [
        idOrSlug,
      ])) as { id: string }[];
      if (rows.length) listingId = rows[0].id;
    }

    if (!listingId) return null;

    let query = `
      SELECT e.* 
      FROM Events e
      JOIN ListingEvents le ON e.id = le.event_id
      WHERE le.listing_id = ?
    `;
    const params: (string | number)[] = [listingId];

    if (filters.search) {
      query += ` AND (e.title LIKE ? OR e.description LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.sport) {
      const sports = Array.isArray(filters.sport)
        ? filters.sport
        : [filters.sport];
      if (sports.length > 0) {
        const placeholders = sports.map(() => '?').join(',');
        query += ` AND EXISTS (
          SELECT 1 FROM EventSports es 
          JOIN Sports s ON es.sport_id = s.id 
          WHERE es.event_id = e.id AND s.name IN (${placeholders})
        )`;
        params.push(...sports);
      }
    }

    if (filters.region) {
      query += ` AND e.region = ?`;
      params.push(filters.region);
    }

    const { startDate, endDate, includePast } = filters;
    const hasDateRange = startDate || endDate;

    if (hasDateRange) {
      if (startDate && endDate) {
        query += ` AND (e.end_date >= ? AND e.start_date <= ?)`;
        params.push(startDate, endDate);
      } else if (startDate) {
        query += ` AND e.end_date >= ?`;
        params.push(startDate);
      } else if (endDate) {
        query += ` AND e.start_date <= ?`;
        params.push(endDate);
      }
    } else if (!includePast) {
      query += ` AND e.end_date >= DATE_SUB(NOW(), INTERVAL 3 DAY)`;
    }

    query += ` ORDER BY e.start_date ASC`;

    const events = (await select(query, params)) as unknown as DbEvent[];

    for (const evt of events) {
      const sports = (await select(
        `SELECT s.name as sport 
           FROM EventSports es
           JOIN Sports s ON es.sport_id = s.id
           WHERE es.event_id = ?`,
        [evt.id]
      )) as { sport: string }[];
      evt.sports = sports.map((s) => s.sport);
    }

    return events.map(mapEventToApi);
  };

  const getListingTimeline = async (
    idOrSlug: string
  ): Promise<Record<
    string,
    { count: number; months: Record<string, number> }
  > | null> => {
    let listingId: string | null = null;
    if (idOrSlug.startsWith('lst_')) {
      const rows = (await select('SELECT id FROM Listings WHERE id = ?', [
        idOrSlug,
      ])) as { id: string }[];
      if (rows.length) listingId = rows[0].id;
    } else {
      const rows = (await select('SELECT id FROM Listings WHERE slug = ?', [
        idOrSlug,
      ])) as { id: string }[];
      if (rows.length) listingId = rows[0].id;
    }

    if (!listingId) return null;

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

    const rows = (await select(query, [listingId])) as {
      year: number;
      month: number;
      count: number;
    }[];

    const result: Record<
      string,
      { count: number; months: Record<string, number> }
    > = {};

    for (const row of rows) {
      const y = row.year;
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

    listListings: async (): Promise<ApiListing[]> => {
      const listings = (await select(
        'SELECT * FROM Listings'
      )) as unknown as DbListing[];
      for (const lst of listings) {
        const eventRows = (await select(
          'SELECT event_id FROM ListingEvents WHERE listing_id = ?',
          [lst.id]
        )) as { event_id: string }[];
        lst.event_ids = eventRows.map((r) => r.event_id);
      }
      return listings.map(mapListingToApi);
    },

    createListing: async (data: {
      title: string;
      slug: string;
      description?: string;
      createdBy: string;
      eventIds?: string[];
      hero_config?: any;
    }): Promise<ApiListing> => {
      const id = `lst_${uuidv4().split('-')[0]}`;
      const { title, slug, description, createdBy, eventIds, hero_config } =
        data;

      await syncUser(createdBy);

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

      return (await getListing(id))!;
    },

    updateListing: async (
      id: string,
      data: {
        title?: string;
        slug?: string;
        description?: string;
        eventIds?: string[];
        hero_config?: any;
      }
    ): Promise<ApiListing | null> => {
      const { title, slug, description, eventIds, hero_config } = data;

      await transaction(async () => {
        const fields: string[] = [];
        const params: (string | number | undefined)[] = [];
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

    deleteListing: async (id: string): Promise<void> => {
      await remove('DELETE FROM Listings WHERE id = ?', [id]);
    },
  };
}

export = listingsService;
