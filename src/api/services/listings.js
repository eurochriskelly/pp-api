const dbHelper = require('../../lib/db-helper');
const { v4: uuidv4 } = require('uuid');

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

      listing.events = events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.start_date,
        endDate: e.end_date,
        location: e.location,
        region: e.region,
        imageUrl: e.image_url,
        organizerId: e.organizer_id,
        sports: e.sports,
      }));
    }

    return mapListingToApi(listing);
  };

  return {
    getListing,

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
