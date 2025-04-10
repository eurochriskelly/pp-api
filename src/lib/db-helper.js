const { II, DD, EE } = require('./logging');
const { promisify } = require("util");

module.exports = (db) => {
  const execute = (query, params = []) => {
    return new Promise((resolve, reject) => {
      DD(`Executing query: ${query}`, params);
      db.query(query, params, (err, results) => {
        if (err) {
          EE(`Query failed: ${err.message}`);
          return reject(err);
        }
        DD(`Query succeeded, rows: ${results.length || results.affectedRows}`);
        resolve(results);
      });
    });
  };

  return {
    // Basic CRUD operations
    select: (query, params) => execute(query, params),
    insert: (query, params) => execute(query, params).then(r => r.insertId),
    update: (query, params) => execute(query, params).then(r => r.affectedRows),
    delete: (query, params) => execute(query, params).then(r => r.affectedRows),

    // Helper for transactions
    transaction: async (operations) => {
      try {
        await execute('START TRANSACTION');
        const result = await operations();
        await execute('COMMIT');
        return result;
      } catch (err) {
        await execute('ROLLBACK');
        throw err;
      }
    }
  };
};
