const dbHelper = require('../../lib/db-helper');

module.exports = (db) => {
  const { select } = dbHelper(db);

  return {
    login: async (email, password) => {
      const users = await select(
        `SELECT id, Email, Role FROM sec_users 
         WHERE Email = ? AND Pass = ? AND IsActive = 1`, // Assuming 'Role' column exists
        [email, password]
      );
      
      if (!users.length) {
        throw new Error("Invalid credentials");
      }

      const user = users[0];
      await update( // Changed from select to update as it's an UPDATE statement
        `UPDATE sec_users SET LastAuthenticated = CURDATE() WHERE id = ?`,
        [user.id]
      );
      
      // Placeholder for actual JWT generation
      const token = `real-jwt-token-for-${user.Email}-${Date.now()}`;

      return { 
        message: "Login successful",
        user: {
          username: user.Email,
          role: user.Role || 'player', // Default role if not in DB, adjust as needed
          email: user.Email,
          id: user.id
        },
        token
      };
    }
  };
};
