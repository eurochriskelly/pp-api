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

interface EventFilters {
  startDate?: string;
  endDate?: string;
  organizerId?: string;
  limit?: string;
}

interface SearchFilters {
  q?: string;
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

function eventsService(dbs: { club?: any; main?: any } | any) {
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

  const resolveUserId = async (idOrEmail: string) => {
    if (typeof idOrEmail !== 'string' || !idOrEmail.includes('@')) {
      return idOrEmail;
    }

    if (!dbMain) return idOrEmail;

    const { select: selectMain } = dbHelper(dbMain);
    const users = (await selectMain(
      'SELECT id FROM sec_users WHERE Email = ?',
      [idOrEmail]
    )) as { id: string }[];

    if (users.length === 0) {
      throw new Error(`User with email '${idOrEmail}' not found.`);
    }

    return users[0].id;
  };

  const getEvent = async (id: string): Promise<ApiEvent | null> => {
    const events = (await select('SELECT * FROM Events WHERE id = ?', [
      id,
    ])) as unknown as DbEvent[];
    if (!events.length) return null;

    const event = events[0];
    const sports = (await select(
      `SELECT s.name as sport 
       FROM EventSports es
       JOIN Sports s ON es.sport_id = s.id
       WHERE es.event_id = ?`,
      [event.id]
    )) as { sport: string }[];
    event.sports = sports.map((s) => s.sport);

    return mapEventToApi(event);
  };

  const processSports = async (
    helper: any,
    eventId: string,
    sportsList: string[]
  ) => {
    if (!sportsList || !sportsList.length) return;

    for (const sportName of sportsList) {
      let sportId: string | number;
      const existingSport = (await helper.select(
        'SELECT id FROM Sports WHERE name = ?',
        [sportName]
      )) as { id: string | number }[];

      if (existingSport.length > 0) {
        sportId = existingSport[0].id;
      } else {
        sportId = await helper.insert('INSERT INTO Sports (name) VALUES (?)', [
          sportName,
        ]);
      }

      await helper.insert(
        'INSERT INTO EventSports (event_id, sport_id) VALUES (?, ?)',
        [eventId, sportId]
      );
    }
  };

  return {
    getEvent,

    searchEvents: async (filters: SearchFilters): Promise<ApiEvent[]> => {
      let query = 'SELECT * FROM Events WHERE 1=1';
      const params: (string | number)[] = [];

      if (filters.q) {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${filters.q}%`, `%${filters.q}%`);
      }

      if (!filters.includePast) {
        query += ' AND end_date >= NOW()';
      }

      query += ' ORDER BY start_date ASC';

      const events = (await select(query, params)) as unknown as DbEvent[];

      for (const event of events) {
        const sports = (await select(
          `SELECT s.name as sport 
           FROM EventSports es
           JOIN Sports s ON es.sport_id = s.id
           WHERE es.event_id = ?`,
          [event.id]
        )) as { sport: string }[];
        event.sports = sports.map((s) => s.sport);
      }

      return events.map(mapEventToApi);
    },

    listEvents: async (filters: EventFilters): Promise<ApiEvent[]> => {
      let query = 'SELECT * FROM Events WHERE 1=1';
      const params: (string | number)[] = [];
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

      const events = (await select(query, params)) as unknown as DbEvent[];

      for (const event of events) {
        const sports = (await select(
          `SELECT s.name as sport 
           FROM EventSports es
           JOIN Sports s ON es.sport_id = s.id
           WHERE es.event_id = ?`,
          [event.id]
        )) as { sport: string }[];
        event.sports = sports.map((s) => s.sport);
      }

      return events.map(mapEventToApi);
    },

    createEvent: async (data: {
      title: string;
      description?: string;
      startDate: string;
      endDate?: string;
      location?: string;
      region?: string;
      imageUrl?: string;
      organizerId?: string;
      organizerEmail?: string;
      sports?: string[];
    }): Promise<ApiEvent> => {
      let {
        title,
        description,
        startDate,
        endDate,
        location,
        region,
        imageUrl,
        organizerId,
        organizerEmail,
        sports,
      } = data;

      if (!organizerId && organizerEmail) {
        organizerId = await resolveUserId(organizerEmail);
      } else if (organizerId) {
        organizerId = await resolveUserId(organizerId);
      }

      if (!title) throw new Error('Title is required');
      if (!startDate) throw new Error('Start date is required');
      if (!organizerId) throw new Error('Organizer ID or Email is required');

      await syncUser(organizerId);

      const id = `evt_${uuidv4().split('-')[0]}`;

      await transaction(async (tx) => {
        await tx.insert(
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

        await processSports(tx, id, sports || []);
      });

      return (await getEvent(id))!;
    },

    updateEvent: async (
      id: string,
      data: {
        title?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        location?: string;
        region?: string;
        imageUrl?: string;
        organizerId?: string;
        organizerEmail?: string;
        sports?: string[];
      }
    ): Promise<void> => {
      const {
        title,
        description,
        startDate,
        endDate,
        location,
        region,
        imageUrl,
        organizerId,
        organizerEmail,
        sports,
      } = data;

      await transaction(async (tx) => {
        const fields: string[] = [];
        const params: (string | number | undefined)[] = [];
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

        let finalOrganizerId = organizerId;
        if (!finalOrganizerId && organizerEmail) {
          finalOrganizerId = await resolveUserId(organizerEmail);
        } else if (finalOrganizerId !== undefined) {
          finalOrganizerId = await resolveUserId(finalOrganizerId);
        }

        if (finalOrganizerId !== undefined) {
          await syncUser(finalOrganizerId);
          fields.push('organizer_id = ?');
          params.push(finalOrganizerId);
        }

        if (fields.length) {
          params.push(id);
          await tx.update(
            `UPDATE Events SET ${fields.join(', ')} WHERE id = ?`,
            params
          );
        }

        if (sports) {
          await tx.delete('DELETE FROM EventSports WHERE event_id = ?', [id]);
          await processSports(tx, id, sports);
        }
      });
    },

    deleteEvent: async (id: string): Promise<void> => {
      await remove('DELETE FROM Events WHERE id = ?', [id]);
    },
  };
}

export = eventsService;
