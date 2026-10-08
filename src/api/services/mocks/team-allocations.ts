import championshipsFactory from './championships';
import {
  AllocationError,
  buildTeam,
  validateAllocations,
  validateSuffix,
} from '../team-allocations/model';

const teams = [
  {
    id: 1,
    tournamentId: 1001,
    competitionId: 1,
    teamName: 'Amsterdam GAC',
    teamType: 'primary',
    teamSuffix: '',
  },
  {
    id: 2,
    tournamentId: 1001,
    competitionId: 1,
    teamName: 'Mixed team',
    teamType: 'combination',
    teamSuffix: '',
  },
];
const allocations = new Map<number, any[]>();
let round = { id: 1, championshipId: 1, roundNumber: 1 };

export default () => {
  const championships = championshipsFactory();
  const getEntrants = () => championships.listEntrants(round.championshipId);
  return {
    createChampionship: async (payload: any) => {
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      const year = Number(payload?.year);
      const numRounds = Number(payload?.numRounds);
      if (
        !name ||
        !Number.isSafeInteger(year) ||
        !Number.isSafeInteger(numRounds)
      )
        throw new AllocationError(
          'Championship name, year, and number of rounds are required'
        );
      return championships.createChampionship({
        seriesId: Number(payload.seriesId) || 1,
        name,
        year,
        numRounds,
        status: 'draft',
      });
    },
    list: async (tournamentId: number) => {
      if (tournamentId !== 1001) return { competitions: [] };
      const entrants = await getEntrants();
      const championship = await championships.getChampionshipById(
        round.championshipId
      );
      return {
        competitions: [
          {
            id: 1,
            category: 'Senior Football',
            round: {
              ...round,
              championshipName: championship?.name,
              numRounds: championship?.numRounds,
            },
            entrants,
            teams: teams.map((team) => ({
              ...buildTeam(
                team,
                entrants,
                allocations.get(team.id) || [],
                true
              ),
              fixtures: [],
            })),
          },
        ],
      };
    },
    save: async (tournamentId: number, teamId: number, payload: any) => {
      const team = teams.find(
        (item) => item.id === teamId && item.tournamentId === tournamentId
      );
      if (!team) throw new AllocationError('Team not found', 404);
      const rows = validateAllocations(payload?.allocations);
      const suffix = validateSuffix(payload?.suffix);
      const entrants = await getEntrants();
      if (
        rows.some(
          (row) =>
            !entrants.some(
              (entrant) =>
                entrant.id === row.entrantId && entrant.status !== 'withdrawn'
            )
        )
      ) {
        throw new AllocationError(
          'Every contributor must be an active or registered entrant in this championship'
        );
      }
      team.teamSuffix = suffix;
      allocations.set(team.id, rows);
    },
    assignRound: async (
      tournamentId: number,
      competitionId: number,
      payload: any
    ) => {
      if (tournamentId !== 1001 || competitionId !== 1)
        throw new AllocationError('Competition not found', 404);
      const championship = await championships.getChampionshipById(
        payload?.championshipId
      );
      if (!championship)
        throw new AllocationError('Championship not found', 404);
      if (
        !Number.isSafeInteger(payload?.roundNumber) ||
        payload.roundNumber <= 0 ||
        payload.roundNumber > championship.numRounds
      ) {
        throw new AllocationError('Invalid championship round number');
      }
      if (
        payload.championshipId !== round.championshipId &&
        [...allocations.values()].some((rows) => rows.length)
      ) {
        throw new AllocationError(
          'Clear team allocations before changing this competition’s championship',
          409
        );
      }
      round = {
        ...round,
        championshipId: payload.championshipId,
        roundNumber: payload.roundNumber,
      };
    },
  };
};
