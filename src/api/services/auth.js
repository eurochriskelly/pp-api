const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dbHelper = require('../../lib/db-helper');
const otpStore = new Map();

const JWT_SECRET =
  process.env.JWT_SECRET || 'development-secret-do-not-use-in-prod';
const SALT_ROUNDS = 10;

module.exports = (db) => {
  const { select, insert, update } = dbHelper(db);

  const { sendOtpEmail } = require('../../lib/email');

  // Helper to fetch user with role from the correct tables
  const getUserWithRole = async (email) => {
    // Join sec_users and sec_roles to get the role correctly
    // Note: This assumes one role per user for now to match previous logic
    const users = await select(
      `SELECT u.id, u.Email, u.Name, u.Pass, u.IsActive, r.RoleName as Role 
       FROM sec_users u 
       LEFT JOIN sec_roles r ON u.id = r.UserId 
       WHERE u.Email = ? AND u.IsActive = 1`,
      [email]
    );
    return users[0];
  };

  const generateToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.Email,
        role: user.Role || 'player',
        username: user.Email,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  };

  return {
    signup: async (email) => {
      const user = await getUserWithRole(email);

      if (!user) {
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

      const user = await getUserWithRole(email);

      if (!user) {
        throw new Error('User not found');
      }

      await update(
        `UPDATE sec_users SET LastAuthenticated = CURDATE() WHERE id = ?`,
        [user.id]
      );

      const token = generateToken(user);

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
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return {
          username: decoded.email,
          role: decoded.role,
          email: decoded.email,
          id: decoded.id,
        };
      } catch (err) {
        throw new Error('Invalid or expired token');
      }
    },

    logout: async (_token) => {
      return { message: 'Logout successful' };
    },

    login: async (email, password) => {
      const user = await getUserWithRole(email);

      if (!user) {
        throw new Error('Invalid credentials');
      }

      let passwordMatch = false;
      let needsRehash = false;

      // Check if password is valid
      if (user.Pass) {
        // 1. Try bcrypt comparison
        const isBcryptMatch = await bcrypt.compare(password, user.Pass);

        if (isBcryptMatch) {
          passwordMatch = true;
        } else {
          // 2. Fallback: Plain text comparison (for migration)
          if (password === user.Pass) {
            passwordMatch = true;
            needsRehash = true;
          }
        }
      }

      if (!passwordMatch) {
        throw new Error('Invalid credentials');
      }

      // Migrate plain text password to bcrypt hash
      if (needsRehash) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await update(`UPDATE sec_users SET Pass = ? WHERE id = ?`, [
          hashedPassword,
          user.id,
        ]);
      }

      await update(
        `UPDATE sec_users SET LastAuthenticated = CURDATE() WHERE id = ?`,
        [user.id]
      );

      const token = generateToken(user);

      return {
        message: 'Login successful',
        user: {
          username: user.Email,
          role: user.Role || 'player',
          email: user.Email,
          id: user.id,
          name: user.Name,
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
        `INSERT INTO sec_users (Email, Name, Pass, Role, IsActive, club_id) VALUES (?, ?, NULL, NULL, 1, ?)`,
        [email, name, club]
      );

      // Assign default role 'player'
      await insert(
        `INSERT INTO sec_roles (UserId, RoleName) VALUES (?, 'player')`,
        [insertId]
      );

      // Send OTP for new user login
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 600 * 1000;
      otpStore.set(email, { code: otp, expires });

      await sendOtpEmail(email, otp);

      const user = await getUserWithRole(email);

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

    checkEmail: async (email) => {
      const user = await getUserWithRole(email);
      return user || null;
    },
  };
};
