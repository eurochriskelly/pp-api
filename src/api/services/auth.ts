import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dbHelper from '../../lib/db-helper';

const otpStore = new Map<string, { code: string; expires: number }>();

const JWT_SECRET =
  process.env.JWT_SECRET || 'development-secret-do-not-use-in-prod';
const SALT_ROUNDS = 10;

interface User {
  id: string;
  Email: string;
  Name: string;
  Pass: string;
  IsActive: number;
  Role: string;
}

function authService(db: any) {
  const { select, insert, update } = dbHelper(db);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sendOtpEmail } = require('../../lib/email');

  const getUserWithRole = async (email: string): Promise<User | undefined> => {
    const users = (await select(
      `SELECT u.id, u.Email, u.Name, u.Pass, u.IsActive, r.RoleName as Role 
       FROM sec_users u 
       LEFT JOIN sec_roles r ON u.id = r.UserId 
       WHERE u.Email = ? AND u.IsActive = 1`,
      [email]
    )) as unknown as User[];
    return users[0];
  };

  const generateToken = (user: User): string => {
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
    signup: async (email: string) => {
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

    verify: async (email: string, code: string) => {
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

    verifyToken: async (token: string) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
          email: string;
          role: string;
          id: string;
        };
        return {
          username: decoded.email,
          role: decoded.role,
          email: decoded.email,
          id: decoded.id,
        };
      } catch {
        throw new Error('Invalid or expired token');
      }
    },

    logout: async (_token: string) => {
      return { message: 'Logout successful' };
    },

    login: async (email: string, password: string) => {
      const user = await getUserWithRole(email);

      if (!user) {
        throw new Error('Invalid credentials');
      }

      let passwordMatch = false;
      let needsRehash = false;

      if (user.Pass) {
        const isBcryptMatch = await bcrypt.compare(password, user.Pass);

        if (isBcryptMatch) {
          passwordMatch = true;
        } else {
          if (password === user.Pass) {
            passwordMatch = true;
            needsRehash = true;
          }
        }
      }

      if (!passwordMatch) {
        throw new Error('Invalid credentials');
      }

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

    register: async (email: string, name: string, club?: string) => {
      const existing = (await select(
        `SELECT id FROM sec_users WHERE Email = ?`,
        [email]
      )) as unknown[];
      if (existing.length) {
        throw new Error('Email already exists');
      }

      const insertId = await insert(
        `INSERT INTO sec_users (Email, Name, Pass, Role, IsActive, club_id) VALUES (?, ?, NULL, NULL, 1, ?)`,
        [email, name, club]
      );

      await insert(
        `INSERT INTO sec_roles (UserId, RoleName) VALUES (?, 'player')`,
        [insertId]
      );

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 600 * 1000;
      otpStore.set(email, { code: otp, expires });

      await sendOtpEmail(email, otp);

      const user = await getUserWithRole(email);

      return {
        message: 'User created, OTP sent',
        data: { ttl: 600 },
        user: {
          id: user!.id,
          email: user!.Email,
          name: user!.Name,
          role: user!.Role,
        },
      };
    },

    getUsers: async (filter?: string) => {
      let query = `SELECT id as userId, Name as name FROM sec_users WHERE IsActive = 1`;
      const params: string[] = [];
      if (filter && filter.length >= 2) {
        query += ` AND LOWER(Name) LIKE LOWER(?)`;
        params.push(`%${filter}%`);
      }
      const users = await select(query, params);
      return users;
    },

    checkEmail: async (email: string) => {
      const user = await getUserWithRole(email);
      return user || null;
    },
  };
}

export = authService;
