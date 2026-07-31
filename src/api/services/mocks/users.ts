// Mock service for user/role management
import { II, DD } from '../../../lib/logging';

interface MockUser {
  id: number;
  email: string;
  name?: string;
  password: string;
  role: string;
  isActive: boolean;
}

interface MockRole {
  id: number;
  userId: number;
  roleName: string;
  tournamentId?: number | null;
}

let nextUserId = 1;
let nextRoleId = 1;

const mockUsers: MockUser[] = [
  {
    id: nextUserId++,
    email: 'admin@pp.com',
    name: 'Admin User',
    password: 'admin',
    role: 'admin',
    isActive: true,
  },
  {
    id: nextUserId++,
    email: 'player@pp.com',
    name: 'Player User',
    password: 'player',
    role: 'player',
    isActive: true,
  },
];

const mockRoles: MockRole[] = [
  { id: nextRoleId++, userId: 1, roleName: 'admin' },
  { id: nextRoleId++, userId: 2, roleName: 'player' },
];

export default function mockUsersService() {
  II('Users mock service initialized');

  return {
    createUser: async (input: {
      email: string;
      name?: string;
      password: string;
      role?: string;
    }) => {
      II(`Mock: createUser called for email [${input.email}]`);
      if (mockUsers.find((u) => u.email === input.email)) {
        throw new Error('Email already exists');
      }
      const user: MockUser = {
        id: nextUserId++,
        email: input.email,
        name: input.name,
        password: input.password,
        role: input.role || 'player',
        isActive: true,
      };
      mockUsers.push(user);
      DD(`Mock: Created user: ${JSON.stringify(user)}`);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    },

    updateUser: async (
      id: number,
      input: { email?: string; name?: string; isActive?: boolean }
    ) => {
      II(`Mock: updateUser called for id [${id}]`);
      const user = mockUsers.find((u) => u.id === id);
      if (!user) {
        throw new Error('User not found');
      }
      if (input.email !== undefined) user.email = input.email;
      if (input.name !== undefined) user.name = input.name;
      if (input.isActive !== undefined) user.isActive = input.isActive;
      DD(`Mock: Updated user: ${JSON.stringify(user)}`);
      return { id: user.id, message: 'User updated' };
    },

    deleteUser: async (id: number) => {
      II(`Mock: deleteUser called for id [${id}]`);
      const idx = mockUsers.findIndex((u) => u.id === id);
      if (idx === -1) {
        throw new Error('User not found');
      }
      mockUsers.splice(idx, 1);
      mockRoles.splice(
        0,
        mockRoles.length,
        ...mockRoles.filter((r) => r.userId !== id)
      );
      DD(`Mock: Deleted user ${id} and associated roles`);
      return { message: 'User deleted' };
    },

    getUser: async (id: number) => {
      II(`Mock: getUser called for id [${id}]`);
      const user = mockUsers.find((u) => u.id === id);
      if (!user) return null;
      const roles = mockRoles
        .filter((r) => r.userId === id)
        .map((r) => ({ id: r.id, RoleName: r.roleName }));
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        roles,
      };
    },

    createRole: async (input: {
      userId: number;
      roleName: string;
      tournamentId?: number;
    }) => {
      II(`Mock: createRole called for userId [${input.userId}]`);
      const role: MockRole = {
        id: nextRoleId++,
        userId: input.userId,
        roleName: input.roleName,
        tournamentId: input.tournamentId || null,
      };
      mockRoles.push(role);
      DD(`Mock: Created role: ${JSON.stringify(role)}`);
      return { id: role.id, userId: role.userId, roleName: role.roleName };
    },

    updateRole: async (id: number, input: { roleName: string }) => {
      II(`Mock: updateRole called for id [${id}]`);
      const role = mockRoles.find((r) => r.id === id);
      if (!role) {
        throw new Error('Role not found');
      }
      role.roleName = input.roleName;
      DD(`Mock: Updated role: ${JSON.stringify(role)}`);
      return { id: role.id, roleName: role.roleName };
    },

    deleteRole: async (id: number) => {
      II(`Mock: deleteRole called for id [${id}]`);
      const idx = mockRoles.findIndex((r) => r.id === id);
      if (idx === -1) {
        throw new Error('Role not found');
      }
      mockRoles.splice(idx, 1);
      DD(`Mock: Deleted role ${id}`);
      return { message: 'Role deleted' };
    },
  };
}

export type MockUsersService = ReturnType<typeof mockUsersService>;
