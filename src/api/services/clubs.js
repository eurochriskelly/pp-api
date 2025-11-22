const dbHelper = require('../../lib/db-helper');

module.exports = (db) => {
  const { select } = dbHelper(db);

  return {
    listClubs: async (search, limit) => {
      let query = 'SELECT clubId, Name FROM clubs WHERE IsActive = 1';
      let params = [];
      if (search && search.length >= 2) {
        query += ' AND LOWER(Name) LIKE LOWER(?)';
        params.push(`%${search}%`);
      }
      query += ' ORDER BY Name LIMIT ?';
      params.push(limit);
      return await select(query, params);
    },
  };
};
