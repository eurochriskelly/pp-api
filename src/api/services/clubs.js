const dbHelper = require('../../lib/db-helper');

module.exports = (db) => {
  const { select } = dbHelper(db);

  return {
    listClubs: async (search, limit) => {
      let query = "SELECT clubId, clubName FROM clubs WHERE status = 'A'";
      let params = [];
      if (search && search.length >= 2) {
        query += ' AND LOWER(clubName) LIKE LOWER(?)';
        params.push(`%${search}%`);
      }
      query += ' ORDER BY Name LIMIT ?';
      params.push(limit);
      return await select(query, params);
    },
  };
};
