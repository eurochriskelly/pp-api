import dbHelper = require('../../lib/db-helper');

interface Club {
  clubId: number;
  clubName: string;
  clubCode?: string;
  isStudent?: boolean;
  founded?: string;
  affiliated?: string;
  deactivated?: string;
  street_address?: string;
  post_code?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  subregion?: string;
  status?: string;
  domain?: string;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

interface ClubsService {
  listClubs: (search?: string, limit?: number) => Promise<Club[]>;
  getClubById: (id: number) => Promise<Club | null>;
  createClub: (clubData: Partial<Club>) => Promise<Club>;
  updateClub: (
    id: number,
    clubData: Partial<Club>
  ) => Promise<Club | { clubId: number; message: string }>;
  deleteClub: (id: number) => Promise<{ clubId: number; message: string }>;
  uploadLogo: (
    id: number,
    logoBuffer: Buffer
  ) => Promise<{ clubId: number; message: string }>;
  getLogo: (id: number) => Promise<Buffer | null>;
}

function clubsService(db: DbConnection): ClubsService {
  const { select, insert, update } = dbHelper(db as any);

  return {
    listClubs: async (search?: string, limit?: number): Promise<Club[]> => {
      let query = "SELECT clubId, clubName FROM clubs WHERE status = 'active'";
      const params: (string | number)[] = [];
      if (search && search.length >= 2) {
        query += ' AND LOWER(clubName) LIKE LOWER(?)';
        params.push(`%${search}%`);
      }
      query += ' ORDER BY clubName LIMIT ?';
      params.push(limit || 100);
      return (await select(query, params)) as unknown as Club[];
    },

    getClubById: async (id: number): Promise<Club | null> => {
      const clubs = (await select(
        `SELECT clubId, clubCode, isStudent, clubName, founded, affiliated, deactivated,
                street_address, post_code, country, city, latitude, longitude,
                region, subregion, status, domain
         FROM clubs WHERE clubId = ?`,
        [id]
      )) as unknown as Club[];
      return clubs[0] || null;
    },

    createClub: async (clubData: Partial<Club>): Promise<Club> => {
      const {
        clubCode,
        isStudent,
        clubName,
        founded,
        affiliated,
        street_address,
        post_code,
        country,
        city,
        latitude,
        longitude,
        region,
        subregion,
        status = 'active',
        domain,
      } = clubData;

      const clubId = await insert(
        `INSERT INTO clubs (clubCode, isStudent, clubName, founded, affiliated,
                           street_address, post_code, country, city, latitude, longitude,
                           region, subregion, status, domain)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clubCode,
          isStudent,
          clubName,
          founded,
          affiliated,
          street_address,
          post_code,
          country,
          city,
          latitude,
          longitude,
          region,
          subregion,
          status,
          domain,
        ]
      );

      return { clubId, ...clubData } as Club;
    },

    updateClub: async (
      id: number,
      clubData: Partial<Club>
    ): Promise<Club | { clubId: number; message: string }> => {
      const fields: string[] = [];
      const params: (string | number | boolean | undefined)[] = [];

      const allowedFields = [
        'clubCode',
        'isStudent',
        'clubName',
        'founded',
        'affiliated',
        'deactivated',
        'street_address',
        'post_code',
        'country',
        'city',
        'latitude',
        'longitude',
        'region',
        'subregion',
        'status',
        'domain',
      ];

      allowedFields.forEach((field) => {
        if (clubData[field as keyof Club] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(clubData[field as keyof Club]);
        }
      });

      if (fields.length === 0) {
        return { clubId: id, message: 'No changes provided' };
      }

      params.push(id);
      await update(
        `UPDATE clubs SET ${fields.join(', ')} WHERE clubId = ?`,
        params
      );

      return { clubId: id, ...clubData } as Club;
    },

    deleteClub: async (
      id: number
    ): Promise<{ clubId: number; message: string }> => {
      await update(`UPDATE clubs SET status = 'inactive' WHERE clubId = ?`, [
        id,
      ]);
      return { clubId: id, message: 'Club deactivated' };
    },

    uploadLogo: async (
      id: number,
      logoBuffer: Buffer
    ): Promise<{ clubId: number; message: string }> => {
      await update(`UPDATE clubs SET clubLogo = ? WHERE clubId = ?`, [
        logoBuffer,
        id,
      ]);
      return { clubId: id, message: 'Logo uploaded successfully' };
    },

    getLogo: async (id: number): Promise<Buffer | null> => {
      const clubs = (await select(
        `SELECT clubLogo FROM clubs WHERE clubId = ?`,
        [id]
      )) as unknown as { clubLogo?: Buffer }[];
      return clubs[0]?.clubLogo || null;
    },
  };
}

export = clubsService;
