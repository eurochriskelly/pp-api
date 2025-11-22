const dbHelper = require('../../lib/db-helper');
const otpStore = new Map();

module.exports = (db) => {
  const { select, insert, update } = dbHelper(db);

  const sendOtpEmail = async (email, otp) => {
    console.log(`[DEV OTP] For ${email}: ${otp} (valid 10min)`);
  };

  return {
    signup: async (email) => {
      const users = await select(
        `SELECT id, Email, Role FROM sec_users WHERE Email = ? AND IsActive = 1`,
        [email]
      );

      if (!users.length) {
        throw new Error('User not found');
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 600 * 1000;
      otpStore.set(email, { code: otp, expires });

      await sendOtpEmail(email, otp);

      return { data: { ttl: 600 } };
    },

    verify: async (email, code) => {
      const stored = otpStore.get(email);
      if (!stored || Date.now() > stored.expires || stored.code !== code) {
        throw new Error('Invalid or expired code');
      }

      otpStore.delete(email);

      const users = await select(
        `SELECT id, Email, Role FROM sec_users WHERE Email = ? AND IsActive = 1`,
        [email]
      );

      if (!users.length) {
        throw new Error('User not found');
      }

      const user = users[0];
      await update(
        `UPDATE sec_users SET LastAuthenticated = CURDATE() WHERE id = ?`,
        [user.id]
      );

      const token = `real-jwt-token-for-${user.Email}-${Date.now()}`;

      return {
        message: 'Verification successful',
        user: {
          username: user.Email,
          role: user.Role || 'player',
          email: user.Email,
          id: user.id,
        },
        token,
      };
    },

    verifyToken: async (token) => {
      if (!token?.startsWith('real-jwt-token-for-')) {
        throw new Error('Invalid token format');
      }

      const emailMatch = token.match(/^real-jwt-token-for-([^-]+)-/);
      if (!emailMatch) {
        throw new Error('Invalid token');
      }

      const email = emailMatch[1];
      const users = await select(
        `SELECT id, Email, Role FROM sec_users WHERE Email = ? AND IsActive = 1`,
        [email]
      );

      if (!users.length) {
        throw new Error('User not found');
      }

      const user = users[0];
      return {
        username: user.Email,
        role: user.Role || 'player',
        email: user.Email,
        id: user.id,
      };
    },

    logout: async (_token) => {
      return { message: 'Logout successful' };
    },

    login: async (email, password) => {
      const users = await select(
        `SELECT id, Email, Role FROM sec_users 
         WHERE Email = ? AND Pass = ? AND IsActive = 1`, // Assuming 'Role' column exists
        [email, password]
      );

      if (!users.length) {
        throw new Error('Invalid credentials');
      }

      const user = users[0];
      await update(
        // Changed from select to update as it's an UPDATE statement
        `UPDATE sec_users SET LastAuthenticated = CURDATE() WHERE id = ?`,
        [user.id]
      );

      // Placeholder for actual JWT generation
      const token = `real-jwt-token-for-${user.Email}-${Date.now()}`;

      return {
        message: 'Login successful',
        user: {
          username: user.Email,
          role: user.Role || 'player', // Default role if not in DB, adjust as needed
          email: user.Email,
          id: user.id,
        },
        token,
      };
    },

    register: async (email, name, club) => {
      // Check if user exists
      const existing = await select(
        `SELECT id FROM sec_users WHERE Email = ?`,
        [email]
      );
      if (existing.length) {
        throw new Error('Email already exists');
      }

      const insertId = await insert(
        `INSERT INTO sec_users (Email, Name, Pass, Role, IsActive, club_id) VALUES (?, ?, NULL, 'player', 1, ?)`,
        [email, name, null]
      );

      // Send OTP for new user login
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 600 * 1000;
      otpStore.set(email, { code: otp, expires });

      await sendOtpEmail(email, otp);

      const user = await select(
        `SELECT id, Email, Name, Role FROM sec_users WHERE id = ?`,
        [insertId]
      )[0];

      return {
        message: 'User created, OTP sent',
        data: { ttl: 600 },
        user: {
          id: user.id,
          email: user.Email,
          name: user.Name,
          role: user.Role,
        },
      };
    },

    getUsers: async (filter) => {
      let query = `SELECT id as userId, Name as name FROM sec_users WHERE IsActive = 1`;
      let params = [];
      if (filter && filter.length >= 2) {
        query += ` AND LOWER(Name) LIKE LOWER(?)`;
        params.push(`%${filter}%`);
      }
      const users = await select(query, params);
      return users;
    },
  };
};
