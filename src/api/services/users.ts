import dbHelper = require('../../lib/db-helper');
import bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

interface User {
  id: number;
  email: string;
  name?: string;
  role?: string;
  isActive: boolean;
  roles?: { id: number; RoleName: string }[];
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

interface UsersService {
  createUser: (input: {
    email: string;
    name?: string;
    password: string;
    role?: string;
  }) => Promise<{ id: number; email: string; name?: string; role: string }>;
  updateUser: (
    id: number,
    input: { email?: string; name?: string; isActive?: boolean }
  ) => Promise<{ id?: number; message: string }>;
  deleteUser: (id: number) => Promise<{ message: string }>;
  getUser: (id: number) => Promise<User | null>;
  createRole: (input: {
    userId: number;
    roleName: string;
    tournamentId?: number;
  }) => Promise<{ id?: number; userId: number; roleName: string }>;
  updateRole: (
    id: number,
    input: { roleName: string }
  ) => Promise<{ id: number; roleName: string }>;
  deleteRole: (id: number) => Promise<{ message: string }>;
}

function usersService(db: DbConnection): UsersService {
  const { select, insert, update, delete: remove } = dbHelper(db as any);

  return {
    // User CRUD
    createUser: async ({
      email,
      name,
      password,
      role,
    }: {
      email: string;
      name?: string;
      password: string;
      role?: string;
    }): Promise<{ id: number; email: string; name?: string; role: string }> => {
      // Check if exists
      const existing = (await select(
        'SELECT id FROM sec_users WHERE Email = ?',
        [email]
      )) as unknown[];
      if (existing.length) throw new Error('Email already exists');

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      const userId = await insert(
        `INSERT INTO sec_users (Email, Name, Pass, IsActive, DateAdded) VALUES (?, ?, ?, 1, NOW())`,
        [email, name, hashedPassword]
      );

      // Add default or specified role
      const roleName = role || 'player';
      await insert(`INSERT INTO sec_roles (UserId, RoleName) VALUES (?, ?)`, [
        userId,
        roleName,
      ]);

      return { id: userId, email, name, role: roleName };
    },

    updateUser: async (
      id: number,
      {
        email,
        name,
        isActive,
      }: { email?: string; name?: string; isActive?: boolean }
    ): Promise<{ id?: number; message: string }> => {
      const fields: string[] = [];
      const params: (string | boolean | number)[] = [];
      if (email) {
        fields.push('Email = ?');
        params.push(email);
      }
      if (name) {
        fields.push('Name = ?');
        params.push(name);
      }
      if (isActive !== undefined) {
        fields.push('IsActive = ?');
        params.push(isActive);
      }

      if (!fields.length) return { message: 'No changes provided' };

      params.push(id);
      await update(
        `UPDATE sec_users SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
      return { id, message: 'User updated' };
    },

    deleteUser: async (id: number): Promise<{ message: string }> => {
      // Delete roles first
      await remove('DELETE FROM sec_roles WHERE UserId = ?', [id]);
      await remove('DELETE FROM sec_users WHERE id = ?', [id]);
      return { message: 'User deleted' };
    },

    getUser: async (id: number): Promise<User | null> => {
      const users = (await select(
        'SELECT id, Email, Name, IsActive FROM sec_users WHERE id = ?',
        [id]
      )) as unknown as User[];
      if (!users.length) return null;
      const user = users[0];
      const roles = (await select(
        'SELECT id, RoleName FROM sec_roles WHERE UserId = ?',
        [id]
      )) as unknown as { id: number; RoleName: string }[];
      user.roles = roles;
      return user;
    },

    // Role CRUD
    createRole: async ({
      userId,
      roleName,
      tournamentId,
    }: {
      userId: number;
      roleName: string;
      tournamentId?: number;
    }): Promise<{ id?: number; userId: number; roleName: string }> => {
      const result = (await insert(
        `INSERT INTO sec_roles (UserId, RoleName, tournamentId) VALUES (?, ?, ?)`,
        [userId, roleName, tournamentId || null]
      )) as unknown;
      return { id: result as number, userId, roleName };
    },

    updateRole: async (
      id: number,
      { roleName }: { roleName: string }
    ): Promise<{ id: number; roleName: string }> => {
      await update('UPDATE sec_roles SET RoleName = ? WHERE id = ?', [
        roleName,
        id,
      ]);
      return { id, roleName };
    },

    deleteRole: async (id: number): Promise<{ message: string }> => {
      await remove('DELETE FROM sec_roles WHERE id = ?', [id]);
      return { message: 'Role deleted' };
    },
  };
}

export = usersService;
