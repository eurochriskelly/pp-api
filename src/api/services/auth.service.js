const dbHelper = require('../../lib/db-helper');

module.exports = (db) => {
  const { select } = dbHelper(db);

  return {
    login: async (email, password) => {
      const users = await select(
        `SELECT * FROM sec_users 
         WHERE Email = ? AND Pass = ? AND IsActive = 1`,
        [email, password]
      );
      
      if (!users.length) {
        throw new Error("Invalid credentials");
      }

      const user = users[0];
      await select(
        `UPDATE sec_users SET LastAuthenticated = CURDATE() WHERE id = ?`,
        [user.id]
      );
      
      return { 
        id: user.id, 
        email: user.Email 
      };
    }
  };
};
