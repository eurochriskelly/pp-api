import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dbHelper from '../../lib/db-helper';
import { sendOtpEmail } from '../../lib/email';

const otpStore = new Map<string, { code: string; expires: number }>();

function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'development-secret-do-not-use-in-prod';
}

const JWT_SECRET = getJwtSecret();
const SALT_ROUNDS = 10;
const INVITE_TTL_SECONDS = 30 * 60;

interface User {
  id: string;
  Email: string;
  Name: string;
  Pass: string;
  IsActive: number;
  Role: string;
  PhoneNumber?: string;
  Verified?: number;
}

function normalisePhone(phone: string): string {
  return phone.trim().replace(/[\s()-]/g, '');
}

function createInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function createLoginCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function authService(db: any) {
  const { select, insert, update } = dbHelper(db);

  const getUserWithRole = async (email: string): Promise<User | undefined> => {
    const users = (await select(
      `SELECT u.id, u.Email, u.Name, u.Pass, u.IsActive, r.RoleName as Role 
       FROM sec_users u 
       LEFT JOIN sec_roles r ON u.id = r.UserId 
       WHERE (u.Email = ? OR u.PhoneNumber = ?) AND u.IsActive = 1`,
      [email, email]
    )) as unknown as User[];
    return users[0];
  };

  const getUserByInviteToken = async (token: string): Promise<any> => {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const users = await select(
      `SELECT id, Email, Name, PhoneNumber, club_id, Verified,
              ManualVerificationRequired, InviteExpiresAt
       FROM sec_users WHERE InviteTokenHash = ?`,
      [tokenHash]
    );
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

    createInvite: async (phone: string) => {
      const normalisedPhone = normalisePhone(phone);
      if (!/^\+?[0-9]{7,15}$/.test(normalisedPhone)) {
        throw new Error('A valid phone number is required');
      }

      const existing = await select(
        `SELECT id, Verified FROM sec_users WHERE PhoneNumber = ?`,
        [normalisedPhone]
      );
      if (existing.length && (existing[0] as any).Verified) {
        throw new Error('A registered user already exists for this phone number');
      }

      const token = createInviteToken();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + INVITE_TTL_SECONDS * 1000);

      if (existing.length) {
        await update(
          `UPDATE sec_users SET InviteTokenHash = ?, InviteExpiresAt = ?,
             ManualVerificationRequired = 0 WHERE id = ?`,
          [tokenHash, expiresAt, (existing[0] as any).id]
        );
      } else {
        const userId = await insert(
          `INSERT INTO sec_users
             (PhoneNumber, IsActive, Verified, ManualVerificationRequired,
              InviteTokenHash, InviteExpiresAt)
           VALUES (?, 0, 0, 0, ?, ?)`,
          [normalisedPhone, tokenHash, expiresAt]
        );
        await insert(`INSERT INTO sec_roles (UserId, RoleName) VALUES (?, 'player')`, [userId]);
      }

      return {
        token,
        phone: normalisedPhone,
        expiresAt: expiresAt.toISOString(),
        ttl: INVITE_TTL_SECONDS,
      };
    },

    getInviteStatus: async (token: string) => {
      const user = await getUserByInviteToken(token);
      if (!user) throw new Error('Invite not found');

      const expired = user.InviteExpiresAt && new Date(user.InviteExpiresAt).getTime() < Date.now();
      if (expired && !user.Verified && !user.ManualVerificationRequired) {
        await update(
          `UPDATE sec_users SET ManualVerificationRequired = 1 WHERE id = ?`,
          [user.id]
        );
      }

      return {
        status: user.Verified
          ? 'registered'
          : expired
            ? 'manual_verification_required'
            : 'pending',
        phone: user.PhoneNumber,
        expiresAt: user.InviteExpiresAt,
      };
    },

    registerFromInvite: async (
      token: string,
      name: string,
      password: string,
      code?: string,
      clubId?: number,
      clubName?: string
    ) => {
      const user = await getUserByInviteToken(token);
      if (!user) throw new Error('Invite not found');
      if (user.Verified) throw new Error('Invite has already been registered');
      if (user.ManualVerificationRequired || new Date(user.InviteExpiresAt).getTime() < Date.now()) {
        await update(
          `UPDATE sec_users SET ManualVerificationRequired = 1 WHERE id = ?`,
          [user.id]
        );
        throw new Error('Registration window expired; manual verification is required');
      }
      if (!name?.trim() || !password || password.length < 8) {
        throw new Error('Name and a password of at least 8 characters are required');
      }
      if (code && !/^\d{6}$/.test(code)) {
        throw new Error('Login code must be exactly 6 digits');
      }

      let selectedClubId = clubId;
      if (!selectedClubId && clubName?.trim()) {
        const matchingClubs = await select(
          `SELECT clubId FROM clubs WHERE LOWER(clubName) = LOWER(?) LIMIT 1`,
          [clubName.trim()]
        );
        selectedClubId = matchingClubs.length
          ? Number((matchingClubs[0] as any).clubId)
          : await insert(
              `INSERT INTO clubs (clubName, status) VALUES (?, 'active')`,
              [clubName.trim()]
            );
      }
      if (!selectedClubId) throw new Error('A club is required');

      const loginCode = code || createLoginCode();
      const [passwordHash, loginCodeHash] = await Promise.all([
        bcrypt.hash(password, SALT_ROUNDS),
        bcrypt.hash(loginCode, SALT_ROUNDS),
      ]);

      await update(
        `UPDATE sec_users SET Name = ?, Pass = ?, club_id = ?, IsActive = 1,
           Verified = 1, ManualVerificationRequired = 0,
           LoginCodeHash = ?, InviteTokenHash = NULL WHERE id = ?`,
        [name.trim(), passwordHash, selectedClubId, loginCodeHash, user.id]
      );

      return {
        message: 'Registration successful',
        loginCode,
        user: {
          id: user.id,
          phone: user.PhoneNumber,
          name: name.trim(),
          clubId: selectedClubId,
          role: 'player',
        },
      };
    },

    loginWithCode: async (phone: string, code: string) => {
      const normalisedPhone = normalisePhone(phone);
      const users = await select(
        `SELECT u.id, u.Email, u.Name, u.PhoneNumber, u.LoginCodeHash,
                r.RoleName as Role
         FROM sec_users u LEFT JOIN sec_roles r ON u.id = r.UserId
         WHERE u.PhoneNumber = ? AND u.IsActive = 1 AND u.Verified = 1`,
        [normalisedPhone]
      );
      const user = users[0] as any;
      if (!user || !user.LoginCodeHash || !(await bcrypt.compare(code, user.LoginCodeHash))) {
        throw new Error('Invalid credentials');
      }
      await update(`UPDATE sec_users SET LastAuthenticated = NOW() WHERE id = ?`, [user.id]);
      const token = generateToken({ ...user, Email: user.Email || user.PhoneNumber });
      return {
        message: 'Login successful',
        token,
        user: { id: user.id, phone: user.PhoneNumber, name: user.Name, role: user.Role || 'player' },
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
