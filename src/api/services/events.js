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

module.exports = (dbs) => {
  // Check if we received the dual-db object or just a single db
  const dbClub = dbs.club || dbs;
  const dbMain = dbs.main; // Only available if passed as object

  const {
    select,
    insert,
    update,
    delete: remove,
    transaction,
  } = dbHelper(dbClub);

  // Helper to sync user from Main DB to Club DB
  const syncUser = async (userId) => {
    // If we don't have access to the main DB, we can't sync.
    // In that case, we hope the user is already there or we fail.
    if (!dbMain) return;

    // 1. Check if user already exists in Club DB
    const existing = await select('SELECT id FROM Users WHERE id = ?', [
      userId,
    ]);
    if (existing.length > 0) return;

    // 2. Fetch user details from Main DB
    // We need to use a raw query or dbHelper on dbMain
    const { select: selectMain } = dbHelper(dbMain);
    // Adjust columns to match what `sec_users` actually has.
    // Assuming 'id', 'Email', 'Name' based on previous auth.js code.
    const users = await selectMain(
      'SELECT id, Email, Name, Role FROM sec_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error(`User ${userId} not found in main database.`);
    }
    const user = users[0];

    // 3. Insert into Club DB Users table
    // Role needs to map to ENUM('organizer', 'admin'). Defaulting to organizer if not admin.
    const role =
      user.Role && user.Role.toLowerCase() === 'admin' ? 'admin' : 'organizer';

    await insert(
      'INSERT INTO Users (id, name, email, role) VALUES (?, ?, ?, ?)',
      [user.id, user.Name, user.Email, role]
    );
  };

  const getEvent = async (id) => {
    const events = await select('SELECT * FROM Events WHERE id = ?', [id]);
    if (!events.length) return null;

    const event = events[0];
    // Join with Sports table to get names
    const sports = await select(
      `SELECT s.name as sport 
       FROM EventSports es
       JOIN Sports s ON es.sport_id = s.id
       WHERE es.event_id = ?`,
      [event.id]
    );
    event.sports = sports.map((s) => s.sport);

    return mapEventToApi(event);
  };

  // Helper to handle sports tags
  const processSports = async (eventId, sportsList) => {
    if (!sportsList || !sportsList.length) return;

    for (const sportName of sportsList) {
      // 1. Find or create the sport
      let sportId;
      const existingSport = await select(
        'SELECT id FROM Sports WHERE name = ?',
        [sportName]
      );

      if (existingSport.length > 0) {
        sportId = existingSport[0].id;
      } else {
        // Insert new sport
        const result = await insert('INSERT INTO Sports (name) VALUES (?)', [
          sportName,
        ]);
        // insert returns insertId
        sportId = result;
      }

      // 2. Link event to sport
      await insert(
        'INSERT INTO EventSports (event_id, sport_id) VALUES (?, ?)',
        [eventId, sportId]
      );
    }
  };

  return {
    getEvent,

    listEvents: async (filters) => {
      let query = 'SELECT * FROM Events WHERE 1=1';
      const params = [];
      if (filters.startDate) {
        query += ' AND start_date >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        query += ' AND end_date <= ?';
        params.push(filters.endDate);
      }
      if (filters.organizerId) {
        query += ' AND organizer_id = ?';
        params.push(filters.organizerId);
      }

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      const events = await select(query, params);

      // Populate sports for all events
      for (const event of events) {
        const sports = await select(
          `SELECT s.name as sport 
           FROM EventSports es
           JOIN Sports s ON es.sport_id = s.id
           WHERE es.event_id = ?`,
          [event.id]
        );
        event.sports = sports.map((s) => s.sport);
      }

      return events.map(mapEventToApi);
    },

    createEvent: async (data) => {
      const {
        title,
        description,
        startDate,
        endDate,
        location,
        region,
        imageUrl,
        organizerId,
        sports,
      } = data;

      // Validation
      if (!title) throw new Error('Title is required');
      if (!startDate) throw new Error('Start date is required');
      if (!organizerId) throw new Error('Organizer ID is required');

      // Sync User first to satisfy Foreign Key
      await syncUser(organizerId);

      const id = `evt_${uuidv4().split('-')[0]}`;

      await transaction(async () => {
        await insert(
          `INSERT INTO Events (id, title, description, start_date, end_date, location, region, image_url, organizer_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            title,
            description,
            startDate,
            endDate,
            location,
            region,
            imageUrl,
            organizerId,
          ]
        );

        await processSports(id, sports);
      });

      return getEvent(id);
    },

    updateEvent: async (id, data) => {
      const {
        title,
        description,
        startDate,
        endDate,
        location,
        region,
        imageUrl,
        organizerId,
        sports,
      } = data;

      await transaction(async () => {
        const fields = [];
        const params = [];
        if (title !== undefined) {
          fields.push('title = ?');
          params.push(title);
        }
        if (description !== undefined) {
          fields.push('description = ?');
          params.push(description);
        }
        if (startDate !== undefined) {
          fields.push('start_date = ?');
          params.push(startDate);
        }
        if (endDate !== undefined) {
          fields.push('end_date = ?');
          params.push(endDate);
        }
        if (location !== undefined) {
          fields.push('location = ?');
          params.push(location);
        }
        if (region !== undefined) {
          fields.push('region = ?');
          params.push(region);
        }
        if (imageUrl !== undefined) {
          fields.push('image_url = ?');
          params.push(imageUrl);
        }
        if (organizerId !== undefined) {
          fields.push('organizer_id = ?');
          params.push(organizerId);
        }

        if (fields.length) {
          params.push(id);
          await update(
            `UPDATE Events SET ${fields.join(', ')} WHERE id = ?`,
            params
          );
        }

        if (sports) {
          await remove('DELETE FROM EventSports WHERE event_id = ?', [id]);
          await processSports(id, sports);
        }
      });
    },

    deleteEvent: async (id) => {
      await remove('DELETE FROM Events WHERE id = ?', [id]);
    },
  };
};
