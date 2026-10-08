export class AllocationError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export interface Entrant {
  id: number;
  championshipId: number;
  displayName: string;
  entrantType: string;
  status: string;
}

export interface Allocation {
  entrantId: number;
  numPlayers: number;
}

export const validateAllocations = (value: unknown): Allocation[] => {
  if (!Array.isArray(value))
    throw new AllocationError('Allocations must be an array');
  const seen = new Set<number>();
  let total = 0;
  return value.map((item) => {
    if (
      !item ||
      !Number.isSafeInteger(item.entrantId) ||
      item.entrantId <= 0 ||
      !Number.isSafeInteger(item.numPlayers) ||
      item.numPlayers <= 0 ||
      item.numPlayers > 2147483647
    ) {
      throw new AllocationError(
        'Each contributor requires an entrant ID and a positive whole player count'
      );
    }
    if (seen.has(item.entrantId))
      throw new AllocationError('A contributor can only appear once per team');
    seen.add(item.entrantId);
    total += item.numPlayers;
    if (total > 2147483647)
      throw new AllocationError('Total player count is too large');
    return { entrantId: item.entrantId, numPlayers: item.numPlayers };
  });
};

export const validateSuffix = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^[A-Z0-9]{1,8}$/i.test(value.trim())) {
    throw new AllocationError(
      'Team suffix must contain 1–8 letters or digits, such as A or B'
    );
  }
  return value.trim().toUpperCase();
};

export const buildTeam = (
  team: any,
  entrants: Entrant[],
  rows: any[],
  hasRound: boolean
) => {
  const eligible = new Map(
    entrants.map((entrant) => [Number(entrant.id), entrant])
  );
  const allocations = rows
    .map((row) => {
      const entrant = eligible.get(Number(row.entrantId));
      return {
        entrantId: Number(row.entrantId),
        numPlayers: row.numPlayers == null ? null : Number(row.numPlayers),
        displayName: entrant?.displayName || 'Unknown entrant',
        entrantType: entrant?.entrantType || null,
        eligible: Boolean(entrant && entrant.status !== 'withdrawn'),
      };
    })
    .sort(
      (a, b) =>
        (b.numPlayers || 0) - (a.numPlayers || 0) || a.entrantId - b.entrantId
    );
  const complete =
    hasRound &&
    allocations.length > 0 &&
    allocations.every((row) => row.eligible && row.numPlayers > 0);
  const totalPlayers = complete
    ? allocations.reduce((sum, row) => sum + row.numPlayers, 0)
    : null;
  const suffix = team.teamSuffix || '';
  const displayName = complete
    ? `${allocations.map((row) => row.displayName).join(' / ')}${suffix ? ` ${suffix}` : ''}`
    : team.teamName;
  return {
    id: Number(team.id),
    fixtureName: team.teamName,
    displayName,
    suffix,
    teamType: allocations.length > 1 ? 'combination' : team.teamType,
    totalPlayers,
    leadingEntrantId: complete ? allocations[0].entrantId : null,
    needsAllocation: !complete,
    allocations: allocations.map((row, index) => ({
      ...row,
      leading: complete && index === 0,
      proportion: totalPlayers ? row.numPlayers / totalPlayers : null,
    })),
  };
};
