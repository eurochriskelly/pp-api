import { Allocation, AllocationError } from './model';

const getCompetition = async (
  tx: any,
  tournamentId: number,
  competitionId: number
) => {
  const [competition] = await tx.select(
    'SELECT * FROM tournament_competitions WHERE id = ? AND tournamentId = ? FOR UPDATE',
    [competitionId, tournamentId]
  );
  if (!competition) throw new AllocationError('Competition not found', 404);
  return competition;
};

export const saveAllocations = async (
  tx: any,
  tournamentId: number,
  teamId: number,
  allocations: Allocation[],
  suffix: string
) => {
  const [candidate] = await tx.select(
    'SELECT competitionId FROM tournament_teams WHERE id = ? AND tournamentId = ?',
    [teamId, tournamentId]
  );
  if (!candidate?.competitionId)
    throw new AllocationError('Team not found in this tournament', 404);
  const competition = await getCompetition(
    tx,
    tournamentId,
    candidate.competitionId
  );
  const [team] = await tx.select(
    'SELECT id FROM tournament_teams WHERE id = ? AND tournamentId = ? AND competitionId = ? FOR UPDATE',
    [teamId, tournamentId, competition.id]
  );
  if (!team) throw new AllocationError('Team not found', 404);
  const [round] = await tx.select(
    'SELECT championshipId FROM championship_competition_rounds WHERE tournamentId = ? AND competition = ?',
    [tournamentId, competition.name]
  );
  if (!round)
    throw new AllocationError(
      'Link this competition to a championship round before assigning players'
    );
  const entrants = await tx.select(
    "SELECT id FROM championship_entrants WHERE championshipId = ? AND status IN ('registered', 'active') FOR UPDATE",
    [round.championshipId]
  );
  const eligible = new Set(entrants.map((row: any) => Number(row.id)));
  if (allocations.some((row) => !eligible.has(row.entrantId))) {
    throw new AllocationError(
      'Every contributor must be an active or registered entrant in this championship'
    );
  }
  const ordered = [...allocations].sort(
    (a, b) => b.numPlayers - a.numPlayers || a.entrantId - b.entrantId
  );
  await tx.delete('DELETE FROM team_entrants WHERE tournamentTeamId = ?', [
    teamId,
  ]);
  for (const row of ordered) {
    await tx.insert(
      'INSERT INTO team_entrants (tournamentTeamId, entrantId, numPlayers) VALUES (?, ?, ?)',
      [teamId, row.entrantId, row.numPlayers]
    );
  }
  await tx.update(
    'UPDATE tournament_teams SET entrantId = ?, teamSuffix = ?, teamType = ? WHERE id = ?',
    [
      ordered[0]?.entrantId || null,
      suffix || null,
      ordered.length > 1
        ? 'combination'
        : suffix && suffix !== 'A'
          ? 'secondary'
          : 'primary',
      teamId,
    ]
  );
};

export const assignRound = async (
  tx: any,
  tournamentId: number,
  competitionId: number,
  payload: any
) => {
  const competition = await getCompetition(tx, tournamentId, competitionId);
  const [championship] = await tx.select(
    'SELECT id, numRounds FROM championships WHERE id = ?',
    [payload.championshipId]
  );
  if (!championship) throw new AllocationError('Championship not found', 404);
  if (payload.roundNumber > championship.numRounds)
    throw new AllocationError(
      'Round number exceeds the championship’s number of rounds'
    );
  const [existing] = await tx.select(
    'SELECT id, championshipId FROM championship_competition_rounds WHERE tournamentId = ? AND competition = ? FOR UPDATE',
    [tournamentId, competition.name]
  );
  if (existing && existing.championshipId !== payload.championshipId) {
    const [allocated] = await tx.select(
      `SELECT a.id FROM team_entrants a JOIN tournament_teams t ON t.id = a.tournamentTeamId WHERE t.competitionId = ? LIMIT 1`,
      [competitionId]
    );
    if (allocated)
      throw new AllocationError(
        'Clear team allocations before changing this competition’s championship',
        409
      );
  }
  if (existing) {
    await tx.update(
      'UPDATE championship_competition_rounds SET championshipId = ?, roundNumber = ? WHERE id = ?',
      [payload.championshipId, payload.roundNumber, existing.id]
    );
  } else {
    await tx.insert(
      'INSERT INTO championship_competition_rounds (championshipId, roundNumber, tournamentId, competition) VALUES (?, ?, ?, ?)',
      [
        payload.championshipId,
        payload.roundNumber,
        tournamentId,
        competition.name,
      ]
    );
  }
};
