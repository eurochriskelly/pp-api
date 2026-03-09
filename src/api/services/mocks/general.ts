// Mock service for general endpoints
import { II, DD } from '../../../lib/logging';

export interface Team {
  id: string;
  name: string;
  category: string;
  stage: string;
  group: number;
}

export interface Pitch {
  id: number;
  pitch: string;
  location: string;
  tournamentId: number;
}

export interface Standing {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  category: string;
  grp: number;
}

export interface User {
  userId: number;
  name: string;
}

export default function mockGeneralService() {
  II('General mock service initialized');

  const mockTeams: Team[] = [
    {
      id: 'T1',
      name: 'Mock Team Alpha',
      category: 'mens',
      stage: 'group',
      group: 1,
    },
    {
      id: 'T2',
      name: 'Mock Team Bravo',
      category: 'mens',
      stage: 'group',
      group: 1,
    },
  ];

  const mockPitches: Pitch[] = [
    { id: 1, pitch: 'Mock Pitch 1', location: 'Near Gate', tournamentId: 1 },
    { id: 2, pitch: 'Mock Pitch 2', location: 'Far End', tournamentId: 1 },
  ];

  const mockStandingsData: Standing[] = [
    {
      team: 'Mock Team Alpha',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      points: 3,
      category: 'mens',
      grp: 1,
    },
    {
      team: 'Mock Team Bravo',
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      points: 0,
      category: 'mens',
      grp: 1,
    },
  ];

  const mockGroups = [{ category: 'mens' }];

  const mockUsers: User[] = [
    { userId: 1, name: 'John Doe' },
    { userId: 2, name: 'Jane Smith' },
    { userId: 3, name: 'Bob Johnson' },
  ];

  return {
    listTeams: async (
      tournamentId: number,
      category?: string,
      stage?: string,
      group?: string
    ) => {
      II(
        `Mock: listTeams called for tId [${tournamentId}], category [${category}], stage [${stage}], group [${group}]`
      );
      const teams = mockTeams.filter(
        (t) =>
          (category ? t.category === category : true) &&
          (stage ? t.stage === stage : true) &&
          (group ? t.group === parseInt(group) : true)
      );
      DD('Mock: Returning teams: ' + JSON.stringify(teams));
      return Promise.resolve(teams);
    },

    listPitches: async (tournamentId: number) => {
      II(`Mock: listPitches called for tId [${tournamentId}]`);
      DD('Mock: Returning pitches: ' + JSON.stringify(mockPitches));
      return Promise.resolve(mockPitches);
    },

    listStandings: async (tournamentId: number, category?: string) => {
      II(
        `Mock: listStandings called for tId [${tournamentId}], category [${category}]`
      );
      const data = category
        ? mockStandingsData.filter((s) => s.category === category)
        : mockStandingsData;
      const groups = category
        ? mockGroups.filter((g) => g.category === category)
        : mockGroups;
      DD('Mock: Returning standings: ' + JSON.stringify({ groups, data }));
      return Promise.resolve({ groups, data });
    },

    getUsers: async (filter?: string) => {
      II(`Mock: getUsers called with filter [${filter}]`);
      const users =
        filter && filter.length >= 2
          ? mockUsers.filter((u) =>
              u.name.toLowerCase().includes(filter.toLowerCase())
            )
          : mockUsers;
      DD('Mock: Returning users: ' + JSON.stringify(users));
      return Promise.resolve(users);
    },
  };
}

export type MockGeneralService = ReturnType<typeof mockGeneralService>;
