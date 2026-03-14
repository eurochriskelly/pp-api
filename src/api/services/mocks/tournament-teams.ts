import { II } from '../../../lib/logging';

type TeamType = 'primary' | 'secondary' | 'combination';

interface MockTeam {
  id: number;
  tournamentId: number;
  entrantId: number;
  teamName: string;
  teamType: TeamType;
  squadSizeSubmitted: number | null;
}

interface MockPlayer {
  id: number;
  squadId: number;
  firstName: string;
  secondName: string;
}

const teams: MockTeam[] = [
  {
    id: 1,
    tournamentId: 1,
    entrantId: 1,
    teamName: 'Amsterdam A',
    teamType: 'primary',
    squadSizeSubmitted: null,
  },
  {
    id: 2,
    tournamentId: 1,
    entrantId: 2,
    teamName: 'Paris-Bordeaux',
    teamType: 'combination',
    squadSizeSubmitted: null,
  },
];

const teamToSquad = new Map<number, number>();
const players: MockPlayer[] = [];

let nextTeamId = 3;
let nextSquadId = 100;
let nextPlayerId = 1000;

const findTeam = (tournamentId: number, teamId: number) =>
  teams.find((t) => t.tournamentId === tournamentId && t.id === teamId) || null;

const ensureSquad = (teamId: number) => {
  let squadId = teamToSquad.get(teamId);
  if (!squadId) {
    squadId = nextSquadId++;
    teamToSquad.set(teamId, squadId);
  }
  return squadId;
};

export default function mockTournamentTeamsService() {
  II('Tournament teams mock service initialized');

  return {
    listTeams: async (tournamentId: number) => {
      return teams
        .filter((t) => t.tournamentId === tournamentId)
        .map((team) => {
          const linkedSquadId = teamToSquad.get(team.id) || null;
          const linkedPlayerCount = linkedSquadId
            ? players.filter((p) => p.squadId === linkedSquadId).length
            : 0;

          return {
            ...team,
            linkedSquadId,
            linkedPlayerCount,
          };
        });
    },

    getTeamById: async (tournamentId: number, teamId: number) => {
      const team = findTeam(tournamentId, teamId);
      if (!team) return null;

      const linkedSquadId = teamToSquad.get(team.id) || null;
      const linkedPlayerCount = linkedSquadId
        ? players.filter((p) => p.squadId === linkedSquadId).length
        : 0;

      return {
        ...team,
        linkedSquadId,
        linkedPlayerCount,
      };
    },

    createTeam: async (
      tournamentId: number,
      data: {
        entrantId: number;
        teamName?: string;
        teamType?: TeamType;
        squadSizeSubmitted?: number;
      }
    ) => {
      const team: MockTeam = {
        id: nextTeamId++,
        tournamentId,
        entrantId: data.entrantId,
        teamName: data.teamName || `Team ${data.entrantId}`,
        teamType: data.teamType || 'primary',
        squadSizeSubmitted: data.squadSizeSubmitted || null,
      };
      teams.push(team);
      return {
        ...team,
        linkedSquadId: null,
        linkedPlayerCount: 0,
      };
    },

    updateTeam: async (
      tournamentId: number,
      teamId: number,
      data: {
        entrantId?: number;
        teamName?: string;
        teamType?: TeamType;
        squadSizeSubmitted?: number;
      }
    ) => {
      const team = findTeam(tournamentId, teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      if (data.entrantId !== undefined) team.entrantId = data.entrantId;
      if (data.teamName !== undefined) team.teamName = data.teamName;
      if (data.teamType !== undefined) team.teamType = data.teamType;
      if (data.squadSizeSubmitted !== undefined) {
        team.squadSizeSubmitted = data.squadSizeSubmitted;
      }

      return {
        ...team,
        linkedSquadId: teamToSquad.get(team.id) || null,
        linkedPlayerCount: players.filter(
          (p) => p.squadId === (teamToSquad.get(team.id) || -1)
        ).length,
      };
    },

    deleteTeam: async (tournamentId: number, teamId: number) => {
      const index = teams.findIndex(
        (t) => t.tournamentId === tournamentId && t.id === teamId
      );
      if (index === -1) {
        throw new Error('Team not found');
      }

      const squadId = teamToSquad.get(teamId);
      if (squadId) {
        for (let i = players.length - 1; i >= 0; i -= 1) {
          if (players[i].squadId === squadId) players.splice(i, 1);
        }
        teamToSquad.delete(teamId);
      }

      teams.splice(index, 1);
      return { id: teamId, tournamentId, message: 'Team deleted' };
    },

    createSquad: async (tournamentId: number, teamId: number, squadSize: number) => {
      const team = findTeam(tournamentId, teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      team.squadSizeSubmitted = squadSize;

      const squadId = ensureSquad(teamId);
      const currentCount = players.filter((p) => p.squadId === squadId).length;

      for (let i = currentCount + 1; i <= squadSize; i += 1) {
        players.push({
          id: nextPlayerId++,
          squadId,
          firstName: 'Player',
          secondName: String(i),
        });
      }

      return {
        tournamentId,
        teamId,
        squadId,
        squadSizeRequested: squadSize,
        players: players.filter((p) => p.squadId === squadId),
      };
    },

    assignPlayer: async (
      tournamentId: number,
      fromTeamId: number,
      toTeamId: number,
      playerId: number
    ) => {
      const fromTeam = findTeam(tournamentId, fromTeamId);
      const toTeam = findTeam(tournamentId, toTeamId);
      if (!fromTeam || !toTeam) {
        throw new Error('Source or target team not found');
      }

      const fromSquadId = ensureSquad(fromTeamId);
      const toSquadId = ensureSquad(toTeamId);

      const player = players.find((p) => p.id === playerId && p.squadId === fromSquadId);
      if (!player) {
        throw new Error('Player not found in source team');
      }

      player.squadId = toSquadId;

      return {
        tournamentId,
        playerId,
        fromTeamId,
        toTeamId,
        fromSquadId,
        toSquadId,
        message: 'Player reassigned',
      };
    },
  };
}
