const { DD, EE } = require('./logging');

module.exports = (db) => {
  const execute = (type, query, params = []) => {
    return new Promise((resolve, reject) => {
      // DD(`Executing [${type}]`);
      // DD(`- query: ${query.split('\n').join(' ').replace(/ /g, ' ')}`);
      //DD(`- params: ${params}`);
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
    select: (query, params) => execute('select', query, params),
    insert: (query, params) =>
      execute('insert', query, params).then((r) => r.insertId),
    update: (query, params) =>
      execute('update', query, params).then((r) => r.affectedRows),
    delete: (query, params) =>
      execute('delete', query, params).then((r) => r.affectedRows),

    // Helper for transactions
    transaction: async (operations) => {
      try {
        await execute('tx', 'START TRANSACTION');
        const result = await operations();
        await execute('tx', 'COMMIT');
        return result;
      } catch (err) {
        await execute('tx', 'ROLLBACK');
        throw err;
      }
    },
  };
};
