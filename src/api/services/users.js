const dbHelper = require('../../lib/db-helper');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

module.exports = (db) => {
  const { select, insert, update, delete: remove } = dbHelper(db);

  return {
    // User CRUD
    createUser: async ({ email, name, password, role }) => {
      // Check if exists
      const existing = await select(
        'SELECT id FROM sec_users WHERE Email = ?',
        [email]
      );
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

    updateUser: async (id, { email, name, isActive }) => {
      const fields = [];
      const params = [];
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

    deleteUser: async (id) => {
      // Delete roles first
      await remove('DELETE FROM sec_roles WHERE UserId = ?', [id]);
      await remove('DELETE FROM sec_users WHERE id = ?', [id]);
      return { message: 'User deleted' };
    },

    getUser: async (id) => {
      const users = await select(
        'SELECT id, Email, Name, IsActive FROM sec_users WHERE id = ?',
        [id]
      );
      if (!users.length) return null;
      const user = users[0];
      const roles = await select(
        'SELECT id, RoleName FROM sec_roles WHERE UserId = ?',
        [id]
      );
      user.roles = roles;
      return user;
    },

    // Role CRUD
    createRole: async ({ userId, roleName, tournamentId }) => {
      const result = await insert(
        `INSERT INTO sec_roles (UserId, RoleName, tournamentId) VALUES (?, ?, ?)`,
        [userId, roleName, tournamentId || null]
      );
      return { id: result.insertId, userId, roleName };
    },

    updateRole: async (id, { roleName }) => {
      await update('UPDATE sec_roles SET RoleName = ? WHERE id = ?', [
        roleName,
        id,
      ]);
      return { id, roleName };
    },

    deleteRole: async (id) => {
      await remove('DELETE FROM sec_roles WHERE id = ?', [id]);
      return { message: 'Role deleted' };
    },
  };
};
