const dbHelper = require('../../lib/db-helper');

module.exports = (db) => {
  const { select, insert, update } = dbHelper(db);

  return {
    listClubs: async (search, limit) => {
      let query = "SELECT clubId, clubName FROM clubs WHERE status = 'active'";
      let params = [];
      if (search && search.length >= 2) {
        query += ' AND LOWER(clubName) LIKE LOWER(?)';
        params.push(`%${search}%`);
      }
      query += ' ORDER BY clubName LIMIT ?';
      params.push(limit);
      return await select(query, params);
    },

    getClubById: async (id) => {
      const clubs = await select(
        `SELECT clubId, clubCode, isStudent, clubName, founded, affiliated, deactivated,
                street_address, post_code, country, city, latitude, longitude,
                region, subregion, status, domain
         FROM clubs WHERE clubId = ?`,
        [id]
      );
      return clubs[0] || null;
    },

    createClub: async (clubData) => {
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

      return { clubId, ...clubData };
    },

    updateClub: async (id, clubData) => {
      const fields = [];
      const params = [];

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
        if (clubData[field] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(clubData[field]);
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

      return { clubId: id, ...clubData };
    },

    deleteClub: async (id) => {
      await update(`UPDATE clubs SET status = 'inactive' WHERE clubId = ?`, [
        id,
      ]);
      return { clubId: id, message: 'Club deactivated' };
    },

    uploadLogo: async (id, logoBuffer) => {
      await update(`UPDATE clubs SET clubLogo = ? WHERE clubId = ?`, [
        logoBuffer,
        id,
      ]);
      return { clubId: id, message: 'Logo uploaded successfully' };
    },

    getLogo: async (id) => {
      const clubs = await select(
        `SELECT clubLogo FROM clubs WHERE clubId = ?`,
        [id]
      );
      return clubs[0]?.clubLogo || null;
    },
  };
};
