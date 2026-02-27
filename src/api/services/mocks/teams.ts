const { II } = require('../../../lib/logging');

type MockTeam = {
  id: number;
  name: string;
  tournamentTempUuid: string;
  tournamentId: number | null;
  competition: string | null;
  contributingClubs: any;
  colors: any;
  logo?: Buffer;
  createdAt: string;
  updatedAt: string;
};

let nextId = 1;
let mockTeams: MockTeam[] = [];

const normalize = (team: MockTeam) => ({
  id: team.id,
  name: team.name,
  tournamentTempUuid: team.tournamentTempUuid,
  tournamentId: team.tournamentId,
  competition: team.competition,
  contributingClubs: team.contributingClubs,
  colors: team.colors,
  createdAt: team.createdAt,
  updatedAt: team.updatedAt,
});

export default () => ({
  getTeams: async ({
    tournamentTempUuid,
    tournamentId,
    competition,
  }: {
    tournamentTempUuid?: string;
    tournamentId?: number;
    competition?: string;
  }) => {
    return mockTeams
      .filter((team) => {
        if (
          tournamentTempUuid &&
          team.tournamentTempUuid !== tournamentTempUuid
        ) {
          return false;
        }
        if (
          typeof tournamentId === 'number' &&
          team.tournamentId !== tournamentId
        ) {
          return false;
        }
        if (competition && team.competition !== competition) {
          return false;
        }
        return true;
      })
      .map(normalize);
  },

  getTeamById: async (id: number) => {
    const team = mockTeams.find((item) => item.id === id);
    return team ? normalize(team) : null;
  },

  createTeam: async (payload: any) => {
    const now = new Date().toISOString();
    const team: MockTeam = {
      id: nextId++,
      name: payload.name,
      tournamentTempUuid: payload.tournamentTempUuid,
      tournamentId: payload.tournamentId || null,
      competition: payload.competition || null,
      contributingClubs: payload.contributingClubs || null,
      colors: payload.colors || null,
      createdAt: now,
      updatedAt: now,
    };
    mockTeams.push(team);
    return normalize(team);
  },

  createBatch: async (tournamentTempUuid: string, teams: any[]) => {
    II(
      `[TEAMS MOCK] Creating ${teams.length} teams in MEMORY (not persisted to database)`
    );
    const created = [];
    for (const payload of teams) {
      created.push(
        await (async () => {
          const now = new Date().toISOString();
          const team: MockTeam = {
            id: nextId++,
            name: payload.name,
            tournamentTempUuid:
              payload.tournamentTempUuid || tournamentTempUuid,
            tournamentId: payload.tournamentId || null,
            competition: payload.competition || null,
            contributingClubs: payload.contributingClubs || null,
            colors: payload.colors || null,
            createdAt: now,
            updatedAt: now,
          };
          mockTeams.push(team);
          return normalize(team);
        })()
      );
    }
    II(
      `[TEAMS MOCK] ✓ Created ${created.length} teams in memory (will be lost on restart)`
    );
    return created;
  },

  assignTournament: async (
    tournamentTempUuid: string,
    tournamentId: number
  ) => {
    let affectedRows = 0;
    mockTeams = mockTeams.map((team) => {
      if (team.tournamentTempUuid !== tournamentTempUuid) {
        return team;
      }
      affectedRows += 1;
      return {
        ...team,
        tournamentId,
        updatedAt: new Date().toISOString(),
      };
    });

    return {
      tournamentTempUuid,
      tournamentId,
      affectedRows,
    };
  },

  updateTeam: async (id: number, payload: any) => {
    const index = mockTeams.findIndex((item) => item.id === id);
    if (index < 0) return null;

    mockTeams[index] = {
      ...mockTeams[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    return normalize(mockTeams[index]);
  },

  uploadLogo: async (id: number, logoBuffer: Buffer) => {
    const index = mockTeams.findIndex((item) => item.id === id);
    if (index < 0) {
      return { id, affectedRows: 0 };
    }
    mockTeams[index].logo = logoBuffer;
    mockTeams[index].updatedAt = new Date().toISOString();
    return { id, affectedRows: 1 };
  },

  getLogo: async (id: number) => {
    const team = mockTeams.find((item) => item.id === id);
    return team?.logo || null;
  },
});
