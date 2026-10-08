import dbHelper from '../../../lib/db-helper';
import {
  AllocationError,
  buildTeam,
  validateAllocations,
  validateSuffix,
} from './model';
import { saveAllocations, assignRound } from './mutations';
import { synchronizeRoster } from './roster';

export default (db: any) => {
  const helper = dbHelper(db);
  return {
    list: async (tournamentId: number) => {
      await synchronizeRoster(helper, tournamentId);
      const [
        competitions,
        rounds,
        entrants,
        teams,
        allocations,
        groupFixtures,
        fixtures,
      ] = await Promise.all([
        helper.select(
          'SELECT id, name FROM tournament_competitions WHERE tournamentId = ? ORDER BY name',
          [tournamentId]
        ),
        helper.select(
          `SELECT r.*, c.name AS championshipName, c.year, c.numRounds, s.name AS seriesName
          FROM championship_competition_rounds r JOIN championships c ON c.id = r.championshipId
          JOIN series s ON s.id = c.seriesId WHERE r.tournamentId = ?`,
          [tournamentId]
        ),
        helper.select(
          `SELECT e.* FROM championship_entrants e
          WHERE e.championshipId IN (SELECT championshipId FROM championship_competition_rounds WHERE tournamentId = ?)
          ORDER BY e.displayName, e.id`,
          [tournamentId]
        ),
        helper.select(
          'SELECT * FROM tournament_teams WHERE tournamentId = ? AND competitionId IS NOT NULL ORDER BY teamName, id',
          [tournamentId]
        ),
        helper.select(
          `SELECT a.* FROM team_entrants a JOIN tournament_teams t ON t.id = a.tournamentTeamId WHERE t.tournamentId = ?`,
          [tournamentId]
        ),
        helper.select(
          "SELECT category, groupNumber, team1Id, team2Id FROM fixtures WHERE tournamentId = ? AND stage = 'group' AND groupNumber IS NOT NULL",
          [tournamentId]
        ),
        helper.select(
          `SELECT id, category, groupNumber, stage, scheduled, pitch, team1Id, team2Id,
                    goals1, points1, goals2, points2, outcome
             FROM fixtures WHERE tournamentId = ? ORDER BY scheduled, id`,
          [tournamentId]
        ),
      ]);
      return {
        competitions: competitions.map((competition: any) => {
          const round: any = rounds.find(
            (row) => row.competition === competition.name
          );
          const roster: any[] = entrants.filter(
            (row) => row.championshipId === round?.championshipId
          );
          const competitionTeams = teams
            .filter((team) => team.competitionId === competition.id)
            .map((team) => ({
              ...buildTeam(
                team,
                roster,
                allocations.filter((row) => row.tournamentTeamId === team.id),
                Boolean(round)
              ),
              groups: [
                ...new Set(
                  groupFixtures
                    .filter(
                      (fixture) =>
                        String(fixture.category).trim() === competition.name &&
                        (fixture.team1Id === team.teamName ||
                          fixture.team2Id === team.teamName)
                    )
                    .map((fixture) => fixture.groupNumber)
                ),
              ].sort((a: any, b: any) => a - b),
              fixtures: fixtures
                .filter(
                  (fixture: any) =>
                    String(fixture.category).trim() === competition.name &&
                    (fixture.team1Id === team.teamName ||
                      fixture.team2Id === team.teamName)
                )
                .map((fixture: any) => {
                  const isTeamOne = fixture.team1Id === team.teamName;
                  const ownGoals = isTeamOne ? fixture.goals1 : fixture.goals2;
                  const ownPoints = isTeamOne
                    ? fixture.points1
                    : fixture.points2;
                  const opponentGoals = isTeamOne
                    ? fixture.goals2
                    : fixture.goals1;
                  const opponentPoints = isTeamOne
                    ? fixture.points2
                    : fixture.points1;
                  const played = fixture.outcome === 'played';
                  return {
                    id: fixture.id,
                    groupNumber: fixture.groupNumber,
                    stage: fixture.stage,
                    scheduled: fixture.scheduled,
                    pitch: fixture.pitch,
                    opponent: isTeamOne ? fixture.team2Id : fixture.team1Id,
                    outcome: fixture.outcome,
                    score:
                      played &&
                      ownGoals !== null &&
                      ownPoints !== null &&
                      opponentGoals !== null &&
                      opponentPoints !== null
                        ? {
                            own: { goals: ownGoals, points: ownPoints },
                            opponent: {
                              goals: opponentGoals,
                              points: opponentPoints,
                            },
                          }
                        : null,
                  };
                }),
            }));
          return {
            id: competition.id,
            category: competition.name,
            round: round || null,
            entrants: roster,
            teams: competitionTeams,
          };
        }),
      };
    },
    save: async (tournamentId: number, teamId: number, payload: any) => {
      const allocations = validateAllocations(payload?.allocations);
      const suffix = validateSuffix(payload?.suffix);
      await helper.transaction((tx) =>
        saveAllocations(tx, tournamentId, teamId, allocations, suffix)
      );
    },
    assignRound: async (
      tournamentId: number,
      competitionId: number,
      payload: any
    ) => {
      if (
        !Number.isSafeInteger(payload?.championshipId) ||
        payload.championshipId <= 0 ||
        !Number.isSafeInteger(payload?.roundNumber) ||
        payload.roundNumber <= 0
      ) {
        throw new AllocationError(
          'Select a championship and a positive whole round number'
        );
      }
      await helper.transaction((tx) =>
        assignRound(tx, tournamentId, competitionId, payload)
      );
    },
    createChampionship: async (payload: any) => {
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      const seriesName =
        typeof payload?.seriesName === 'string'
          ? payload.seriesName.trim()
          : '';
      const year = Number(payload?.year);
      const numRounds = Number(payload?.numRounds);
      const seriesId =
        payload?.seriesId === '' ? null : Number(payload?.seriesId);
      if (!name || name.length > 160)
        throw new AllocationError('Championship name is required');
      if (!Number.isSafeInteger(year) || year < 2000 || year > 2100)
        throw new AllocationError('Enter a valid championship year');
      if (!Number.isSafeInteger(numRounds) || numRounds < 1 || numRounds > 99)
        throw new AllocationError('Number of rounds must be between 1 and 99');
      if (seriesId && !Number.isSafeInteger(seriesId))
        throw new AllocationError('Choose a valid series');
      if (!seriesId && (!seriesName || seriesName.length > 160))
        throw new AllocationError('Choose a series or enter a new series name');
      return helper.transaction(async (tx) => {
        let resolvedSeriesId = seriesId;
        if (resolvedSeriesId) {
          const [series] = await tx.select(
            'SELECT id FROM series WHERE id = ?',
            [resolvedSeriesId]
          );
          if (!series) throw new AllocationError('Series not found', 404);
        } else {
          resolvedSeriesId = await tx.insert(
            `INSERT INTO series (name, defaultSquadSize, defaultPlayersPerTeam, status)
             VALUES (?, 15, 15, 'active')`,
            [seriesName]
          );
        }
        const id = await tx.insert(
          `INSERT INTO championships (seriesId, name, year, numRounds, status)
           VALUES (?, ?, ?, ?, 'draft')`,
          [resolvedSeriesId, name, year, numRounds]
        );
        return {
          id,
          seriesId: resolvedSeriesId,
          name,
          year,
          numRounds,
          status: 'draft',
        };
      });
    },
  };
};
