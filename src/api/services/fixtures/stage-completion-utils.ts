export interface TieBreakerConfig {
  totalPoints: (row: StandingRow) => number;
  pointsDifference: (row: StandingRow) => number;
  pointsFrom: (row: StandingRow) => number;
  groupNumber: (row: StandingRow) => number;
}

export interface StandingRow {
  team?: string;
  TotalPoints?: number | string;
  PointsDifference?: number | string;
  PointsFrom?: number | string;
  position?: number | string;
  grp?: number | string;
  [key: string]: any;
}

export interface GroupFixtureRow {
  team1?: string;
  team2?: string;
  goals1?: number | null;
  points1?: number | null;
  goals2?: number | null;
  points2?: number | null;
  outcome?: string | null;
}

export interface CategoryFixtureRow extends GroupFixtureRow {
  grp?: number | string;
  groupNumber?: number | string;
}

export interface PlaceholderAssignment {
  placeholder: string;
  teamId: string | null;
}

export interface GroupZeroPlan {
  shouldSkip: boolean;
  reason: string;
  remainingMatches: number;
  assignments: PlaceholderAssignment[];
}

export interface DeltaEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface DeltaFixtureRow {
  id: number;
  teamId: string | null;
  planned: string;
}

const DEFAULT_TIE_BREAKERS: TieBreakerConfig = {
  totalPoints: (row) => Number(row?.TotalPoints) || 0,
  pointsDifference: (row) => Number(row?.PointsDifference) || 0,
  pointsFrom: (row) => Number(row?.PointsFrom) || 0,
  groupNumber: (row) => Number(row?.grp) || 0,
};

export function deriveBestPlaceholderAssignments({
  position,
  standings = [],
  tieBreakers,
}: {
  position: number;
  standings: StandingRow[];
  tieBreakers?: TieBreakerConfig;
}): PlaceholderAssignment[] {
  if (!position || position <= 0) return [];

  const ordered = sortCategoryStandings(standings, tieBreakers);
  return ordered.map((row, index) => ({
    placeholder: `~best:${index + 1}/p:${position}`,
    teamId: row?.team ?? null,
  }));
}

export function deriveWorstPlaceholderAssignments({
  position,
  standings = [],
  tieBreakers,
}: {
  position: number;
  standings: StandingRow[];
  tieBreakers?: TieBreakerConfig;
}): PlaceholderAssignment[] {
  if (!position || position <= 0) return [];

  const ordered = sortCategoryStandings(standings, tieBreakers).reverse();
  return ordered.map((row, index) => ({
    placeholder: `~worst:${index + 1}/p:${position}`,
    teamId: row?.team ?? null,
  }));
}

export function planGroupZeroAssignments({
  remainingMatches,
  standings = [],
  totalPositions,
  tieBreakers,
  fixtures = [],
}: {
  remainingMatches?: number;
  standings: StandingRow[];
  totalPositions: number;
  tieBreakers?: TieBreakerConfig;
  fixtures?: CategoryFixtureRow[];
}): GroupZeroPlan {
  if (!totalPositions || totalPositions <= 0) {
    return {
      shouldSkip: true,
      reason: 'no-positions',
      remainingMatches: remainingMatches || 0,
      assignments: [],
    };
  }

  if ((remainingMatches || 0) > 0) {
    return {
      shouldSkip: true,
      reason: 'remaining-matches',
      remainingMatches: remainingMatches || 0,
      assignments: [],
    };
  }

  const assignments = deriveCategoryPlaceholderAssignments({
    standings,
    totalPositions,
    tieBreakers,
    fixtures,
  });

  return {
    shouldSkip: false,
    reason: 'assign',
    remainingMatches: 0,
    assignments,
  };
}

export function evaluatePlaceholderDelta({
  tournamentId,
  category,
  teamField,
  placeholder,
  beforeRows = [],
  afterRows = [],
}: {
  tournamentId: number;
  category: string;
  teamField: string;
  placeholder: string;
  beforeRows?: DeltaFixtureRow[];
  afterRows?: DeltaFixtureRow[];
}): DeltaEntry[] {
  const entries: DeltaEntry[] = [];

  if (beforeRows.length === 0 && afterRows.length === 0) {
    entries.push({
      level: 'debug',
      message: `StageCompletion: no fixtures reference ${teamField} placeholder '${placeholder}' in tournament ${tournamentId} / category ${category}.`,
    });
    return entries;
  }

  const previous = new Map(beforeRows.map((row) => [row.id, row]));

  if (afterRows.length === 0) {
    entries.push({
      level: 'info',
      message: `StageCompletion: fixtures referencing ${teamField} placeholder '${placeholder}' were removed before logging (tournament ${tournamentId}, category ${category}).`,
    });
    return entries;
  }

  afterRows.forEach(({ id, teamId, planned }) => {
    const before = previous.get(id);
    const beforeLabel = before?.teamId ?? before?.planned ?? 'n/a';

    if (!before) {
      entries.push({
        level: 'info',
        message: `StageCompletion: fixture ${id} newly references ${teamField} placeholder '${placeholder}' (resolved value '${teamId ?? 'pending'}').`,
      });
      return;
    }

    if (teamId && teamId !== planned && teamId !== before.teamId) {
      entries.push({
        level: 'info',
        message: `StageCompletion: fixture ${id} resolved ${teamField} placeholder '${placeholder}' from '${beforeLabel}' to '${teamId}'.`,
      });
      return;
    }

    if (before.teamId !== teamId) {
      entries.push({
        level: 'info',
        message: `StageCompletion: fixture ${id} ${teamField} placeholder '${placeholder}' changed value from '${beforeLabel}' to '${teamId ?? planned}'.`,
      });
      return;
    }

    if (!teamId || teamId === planned) {
      entries.push({
        level: 'debug',
        message: `StageCompletion: fixture ${id} still pending for ${teamField} placeholder '${placeholder}'.`,
      });
    } else {
      entries.push({
        level: 'debug',
        message: `StageCompletion: fixture ${id} already had ${teamField} placeholder '${placeholder}' resolved to '${teamId}'.`,
      });
    }
  });

  return entries;
}

export function deriveGroupPlaceholderAssignments({
  stage,
  groupNumber,
  totalPositions,
  standings = [],
}: {
  stage: string;
  groupNumber: number;
  totalPositions: number;
  standings: StandingRow[];
}): PlaceholderAssignment[] {
  if (!totalPositions || totalPositions <= 0) return [];

  const placeholders: PlaceholderAssignment[] = [];
  for (let index = 0; index < totalPositions; index += 1) {
    const teamId = standings[index]?.team ?? null;
    placeholders.push({
      placeholder: `~${stage}:${groupNumber}/p:${index + 1}`,
      teamId,
    });
  }
  return placeholders;
}

function sortGroupStandingsForResolution(
  standings: StandingRow[] = [],
  tieBreakers: TieBreakerConfig = DEFAULT_TIE_BREAKERS
): StandingRow[] {
  return standings
    .filter((row) => row && row.team)
    .slice()
    .sort((a, b) => {
      const positionA = Number(a?.position);
      const positionB = Number(b?.position);
      const hasPositionA = Number.isFinite(positionA) && positionA > 0;
      const hasPositionB = Number.isFinite(positionB) && positionB > 0;

      if (hasPositionA && hasPositionB && positionA !== positionB) {
        return positionA - positionB;
      }

      const totalPointsDiff =
        tieBreakers.totalPoints(b) - tieBreakers.totalPoints(a);
      if (totalPointsDiff !== 0) return totalPointsDiff;

      const pointsDifferenceDiff =
        tieBreakers.pointsDifference(b) - tieBreakers.pointsDifference(a);
      if (pointsDifferenceDiff !== 0) return pointsDifferenceDiff;

      const pointsFromDiff =
        tieBreakers.pointsFrom(b) - tieBreakers.pointsFrom(a);
      if (pointsFromDiff !== 0) return pointsFromDiff;

      return String(a?.team || '').localeCompare(String(b?.team || ''));
    });
}

function isCompletedFixture(fixture: GroupFixtureRow): boolean {
  if (
    fixture?.goals1 === null ||
    fixture?.goals1 === undefined ||
    fixture?.points1 === null ||
    fixture?.points1 === undefined ||
    fixture?.goals2 === null ||
    fixture?.goals2 === undefined ||
    fixture?.points2 === null ||
    fixture?.points2 === undefined
  ) {
    return false;
  }

  return !['conceded', 'forfeit', 'not played'].includes(
    String(fixture?.outcome || '').toLowerCase()
  );
}

function createPairKey(teamA: string, teamB: string): string {
  return [teamA, teamB].sort().join('::');
}

interface PairwiseH2HState {
  points: Record<string, number>;
  diff: Record<string, number>;
  scoreFor: Record<string, number>;
  hasRemaining: boolean;
}

function buildPairwiseStates(
  fixtures: GroupFixtureRow[] = []
): Map<string, PairwiseH2HState> {
  const states = new Map<string, PairwiseH2HState>();

  fixtures.forEach((fixture) => {
    const team1 = String(fixture?.team1 || '');
    const team2 = String(fixture?.team2 || '');
    if (!team1 || !team2) return;

    const key = createPairKey(team1, team2);
    const state = states.get(key) || {
      points: { [team1]: 0, [team2]: 0 },
      diff: { [team1]: 0, [team2]: 0 },
      scoreFor: { [team1]: 0, [team2]: 0 },
      hasRemaining: false,
    };

    state.points[team1] = state.points[team1] || 0;
    state.points[team2] = state.points[team2] || 0;
    state.diff[team1] = state.diff[team1] || 0;
    state.diff[team2] = state.diff[team2] || 0;
    state.scoreFor[team1] = state.scoreFor[team1] || 0;
    state.scoreFor[team2] = state.scoreFor[team2] || 0;

    if (!isCompletedFixture(fixture)) {
      state.hasRemaining = true;
      states.set(key, state);
      return;
    }

    const score1 =
      (Number(fixture.goals1) || 0) * 3 + (Number(fixture.points1) || 0);
    const score2 =
      (Number(fixture.goals2) || 0) * 3 + (Number(fixture.points2) || 0);

    state.scoreFor[team1] += score1;
    state.scoreFor[team2] += score2;
    state.diff[team1] += score1 - score2;
    state.diff[team2] += score2 - score1;

    if (score1 > score2) {
      state.points[team1] += 2;
    } else if (score2 > score1) {
      state.points[team2] += 2;
    } else {
      state.points[team1] += 1;
      state.points[team2] += 1;
    }

    states.set(key, state);
  });

  return states;
}

function countRemainingMatchesByTeam(
  fixtures: GroupFixtureRow[] = []
): Map<string, number> {
  const counts = new Map<string, number>();

  fixtures.forEach((fixture) => {
    if (isCompletedFixture(fixture)) return;

    const team1 = String(fixture?.team1 || '');
    const team2 = String(fixture?.team2 || '');
    if (team1) counts.set(team1, (counts.get(team1) || 0) + 1);
    if (team2) counts.set(team2, (counts.get(team2) || 0) + 1);
  });

  return counts;
}

function hasGuaranteedHeadToHeadAdvantage(
  teamA: StandingRow,
  teamB: StandingRow,
  pairwiseStates: Map<string, PairwiseH2HState>,
  remainingMatchesByTeam: Map<string, number>,
  tieBreakers: TieBreakerConfig
): boolean {
  const teamAId = String(teamA?.team || '');
  const teamBId = String(teamB?.team || '');
  if (!teamAId || !teamBId) return false;

  const state = pairwiseStates.get(createPairKey(teamAId, teamBId));
  if (!state || state.hasRemaining) return false;

  const h2hPointsA = state.points[teamAId] || 0;
  const h2hPointsB = state.points[teamBId] || 0;
  if (h2hPointsA !== h2hPointsB) {
    return h2hPointsA > h2hPointsB;
  }

  const h2hDiffA = state.diff[teamAId] || 0;
  const h2hDiffB = state.diff[teamBId] || 0;
  if (h2hDiffA !== h2hDiffB) {
    return h2hDiffA > h2hDiffB;
  }

  const h2hScoreForA = state.scoreFor[teamAId] || 0;
  const h2hScoreForB = state.scoreFor[teamBId] || 0;
  if (h2hScoreForA !== h2hScoreForB) {
    return h2hScoreForA > h2hScoreForB;
  }

  const teamARemaining = remainingMatchesByTeam.get(teamAId) || 0;
  const teamBRemaining = remainingMatchesByTeam.get(teamBId) || 0;
  if (teamARemaining === 0 && teamBRemaining === 0) {
    const pointsDiffA = tieBreakers.pointsDifference(teamA);
    const pointsDiffB = tieBreakers.pointsDifference(teamB);
    if (pointsDiffA !== pointsDiffB) {
      return pointsDiffA > pointsDiffB;
    }

    const pointsFromA = tieBreakers.pointsFrom(teamA);
    const pointsFromB = tieBreakers.pointsFrom(teamB);
    if (pointsFromA !== pointsFromB) {
      return pointsFromA > pointsFromB;
    }
  }

  return false;
}

function isGuaranteedAhead(
  teamA: StandingRow,
  teamB: StandingRow,
  remainingMatchesByTeam: Map<string, number>,
  pairwiseStates: Map<string, PairwiseH2HState>,
  winPoints: number,
  tieBreakers: TieBreakerConfig
): boolean {
  const currentPointsA = tieBreakers.totalPoints(teamA);
  const currentPointsB = tieBreakers.totalPoints(teamB);
  const maxPointsB =
    currentPointsB +
    (remainingMatchesByTeam.get(String(teamB?.team || '')) || 0) * winPoints;

  if (currentPointsA > maxPointsB) {
    return true;
  }

  if (currentPointsA < maxPointsB) {
    return false;
  }

  return hasGuaranteedHeadToHeadAdvantage(
    teamA,
    teamB,
    pairwiseStates,
    remainingMatchesByTeam,
    tieBreakers
  );
}

function canFinishAhead(
  challenger: StandingRow,
  target: StandingRow,
  remainingMatchesByTeam: Map<string, number>,
  pairwiseStates: Map<string, PairwiseH2HState>,
  winPoints: number,
  tieBreakers: TieBreakerConfig
): boolean {
  const challengerMaxPoints =
    tieBreakers.totalPoints(challenger) +
    (remainingMatchesByTeam.get(String(challenger?.team || '')) || 0) *
      winPoints;
  const targetMinPoints = tieBreakers.totalPoints(target);

  if (challengerMaxPoints > targetMinPoints) {
    return true;
  }

  if (challengerMaxPoints < targetMinPoints) {
    return false;
  }

  return !isGuaranteedAhead(
    target,
    challenger,
    remainingMatchesByTeam,
    pairwiseStates,
    winPoints,
    tieBreakers
  );
}

export function derivePredictiveGroupPlaceholderAssignments({
  stage,
  groupNumber,
  totalPositions,
  standings = [],
  fixtures = [],
  winPoints = 3,
  tieBreakers = DEFAULT_TIE_BREAKERS,
}: {
  stage: string;
  groupNumber: number;
  totalPositions: number;
  standings: StandingRow[];
  fixtures: GroupFixtureRow[];
  winPoints?: number;
  tieBreakers?: TieBreakerConfig;
}): PlaceholderAssignment[] {
  if (!totalPositions || totalPositions <= 0) return [];

  const ordered = sortGroupStandingsForResolution(standings, tieBreakers);
  const remainingMatchesByTeam = countRemainingMatchesByTeam(fixtures);
  const pairwiseStates = buildPairwiseStates(fixtures);

  return Array.from({ length: totalPositions }, (_, index) => {
    const position = index + 1;
    const team = ordered[index];

    if (!team?.team) {
      return {
        placeholder: `~${stage}:${groupNumber}/p:${position}`,
        teamId: null,
      };
    }

    const teamsGuaranteedAhead = ordered.filter(
      (other) =>
        other.team !== team.team &&
        isGuaranteedAhead(
          other,
          team,
          remainingMatchesByTeam,
          pairwiseStates,
          winPoints,
          tieBreakers
        )
    ).length;

    const teamsThatCanFinishAhead = ordered.filter(
      (other) =>
        other.team !== team.team &&
        canFinishAhead(
          other,
          team,
          remainingMatchesByTeam,
          pairwiseStates,
          winPoints,
          tieBreakers
        )
    ).length;

    const bestPossiblePosition = teamsGuaranteedAhead + 1;
    const worstPossiblePosition = teamsThatCanFinishAhead + 1;

    return {
      placeholder: `~${stage}:${groupNumber}/p:${position}`,
      teamId:
        bestPossiblePosition === position && worstPossiblePosition === position
          ? String(team.team)
          : null,
    };
  });
}

export function sortCategoryStandings(
  standings: StandingRow[] = [],
  tieBreakers: TieBreakerConfig = DEFAULT_TIE_BREAKERS
): StandingRow[] {
  const byTotalPoints = tieBreakers.totalPoints;
  const byPointsDiff = tieBreakers.pointsDifference;
  const byPointsFrom = tieBreakers.pointsFrom;
  const byGroup = tieBreakers.groupNumber;

  return standings
    .filter((row) => row && row.team)
    .slice()
    .sort((a, b) => {
      const totalPointsDiff = byTotalPoints(b) - byTotalPoints(a);
      if (totalPointsDiff !== 0) return totalPointsDiff;

      const pointsDifferenceDiff = byPointsDiff(b) - byPointsDiff(a);
      if (pointsDifferenceDiff !== 0) return pointsDifferenceDiff;

      const pointsFromDiff = byPointsFrom(b) - byPointsFrom(a);
      if (pointsFromDiff !== 0) return pointsFromDiff;

      return byGroup(a) - byGroup(b);
    });
}

function sortStandingsWithinGroup(
  standings: StandingRow[] = [],
  tieBreakers: TieBreakerConfig = DEFAULT_TIE_BREAKERS
): StandingRow[] {
  return standings
    .filter((row) => row && row.team)
    .slice()
    .sort((a, b) => {
      const positionA = Number(a?.position);
      const positionB = Number(b?.position);
      const hasPositionA = Number.isFinite(positionA) && positionA > 0;
      const hasPositionB = Number.isFinite(positionB) && positionB > 0;

      if (hasPositionA && hasPositionB && positionA !== positionB) {
        return positionA - positionB;
      }

      const totalPointsDiff =
        tieBreakers.totalPoints(b) - tieBreakers.totalPoints(a);
      if (totalPointsDiff !== 0) return totalPointsDiff;

      const pointsDifferenceDiff =
        tieBreakers.pointsDifference(b) - tieBreakers.pointsDifference(a);
      if (pointsDifferenceDiff !== 0) return pointsDifferenceDiff;

      const pointsFromDiff =
        tieBreakers.pointsFrom(b) - tieBreakers.pointsFrom(a);
      if (pointsFromDiff !== 0) return pointsFromDiff;

      return String(a?.team || '').localeCompare(String(b?.team || ''));
    });
}

function orderCategoryStandingsForOverallGroupOrder(
  standings: StandingRow[] = [],
  tieBreakers: TieBreakerConfig = DEFAULT_TIE_BREAKERS,
  fixtures: CategoryFixtureRow[] = []
): StandingRow[] {
  const rows = standings.filter((row) => row && row.team);
  if (rows.length === 0) return [];

  const byGroup = new Map<number, StandingRow[]>();
  rows.forEach((row) => {
    const groupNumber = tieBreakers.groupNumber(row);
    const bucket = byGroup.get(groupNumber) || [];
    bucket.push(row);
    byGroup.set(groupNumber, bucket);
  });

  if (byGroup.size <= 1) {
    return sortCategoryStandings(rows, tieBreakers);
  }

  const orderedGroups = Array.from(byGroup.values()).map((groupRows) =>
    sortStandingsWithinGroup(groupRows, tieBreakers)
  );
  const groupSizes = orderedGroups.map((groupRows) => groupRows.length);
  const minGroupSize = Math.min(...groupSizes);
  const maxGroupSize = Math.max(...groupSizes);

  if (minGroupSize === maxGroupSize) {
    return sortCategoryStandings(rows, tieBreakers);
  }

  const coreRows = orderedGroups.flatMap((groupRows) =>
    groupRows.slice(0, minGroupSize)
  );
  const extraRows = orderedGroups.flatMap((groupRows) =>
    groupRows.slice(minGroupSize)
  );
  const coreTeams = new Set(coreRows.map((row) => String(row.team || '')));
  const coreRowsByTeam = new Map(
    coreRows.map((row) => [String(row.team || ''), row] as const)
  );
  if (fixtures.length === 0) {
    return [
      ...sortCategoryStandings(coreRows, tieBreakers),
      ...sortCategoryStandings(extraRows, tieBreakers),
    ];
  }
  const normalizedCoreRows = coreRows.map((row) => ({
    ...row,
    MatchesPlayed: 0,
    Wins: 0,
    Draws: 0,
    Losses: 0,
    PointsFrom: 0,
    PointsDifference: 0,
    TotalPoints: 0,
  }));
  const normalizedCoreRowsByTeam = new Map(
    normalizedCoreRows.map((row) => [String(row.team || ''), row] as const)
  );
  let normalizedMatchCount = 0;

  fixtures.forEach((fixture) => {
    const team1 = String(fixture?.team1 || '');
    const team2 = String(fixture?.team2 || '');
    if (!team1 || !team2) return;
    if (!coreTeams.has(team1) || !coreTeams.has(team2)) return;

    const row1 = coreRowsByTeam.get(team1);
    const row2 = coreRowsByTeam.get(team2);
    if (!row1 || !row2) return;

    if (tieBreakers.groupNumber(row1) !== tieBreakers.groupNumber(row2)) {
      return;
    }

    if (
      fixture?.goals1 === null ||
      fixture?.goals1 === undefined ||
      fixture?.points1 === null ||
      fixture?.points1 === undefined ||
      fixture?.goals2 === null ||
      fixture?.goals2 === undefined ||
      fixture?.points2 === null ||
      fixture?.points2 === undefined
    ) {
      return;
    }

    if (
      ['conceded', 'forfeit', 'not played'].includes(
        String(fixture?.outcome || '').toLowerCase()
      )
    ) {
      return;
    }

    const score1 = Number(fixture.goals1) * 3 + Number(fixture.points1);
    const score2 = Number(fixture.goals2) * 3 + Number(fixture.points2);
    const normalized1 = normalizedCoreRowsByTeam.get(team1);
    const normalized2 = normalizedCoreRowsByTeam.get(team2);
    if (!normalized1 || !normalized2) return;
    normalizedMatchCount += 1;

    normalized1.MatchesPlayed = (Number(normalized1.MatchesPlayed) || 0) + 1;
    normalized2.MatchesPlayed = (Number(normalized2.MatchesPlayed) || 0) + 1;
    normalized1.PointsFrom = (Number(normalized1.PointsFrom) || 0) + score1;
    normalized2.PointsFrom = (Number(normalized2.PointsFrom) || 0) + score2;
    normalized1.PointsDifference =
      (Number(normalized1.PointsDifference) || 0) + (score1 - score2);
    normalized2.PointsDifference =
      (Number(normalized2.PointsDifference) || 0) + (score2 - score1);

    if (score1 > score2) {
      normalized1.Wins = (Number(normalized1.Wins) || 0) + 1;
      normalized2.Losses = (Number(normalized2.Losses) || 0) + 1;
      normalized1.TotalPoints = (Number(normalized1.TotalPoints) || 0) + 3;
    } else if (score2 > score1) {
      normalized2.Wins = (Number(normalized2.Wins) || 0) + 1;
      normalized1.Losses = (Number(normalized1.Losses) || 0) + 1;
      normalized2.TotalPoints = (Number(normalized2.TotalPoints) || 0) + 3;
    } else {
      normalized1.Draws = (Number(normalized1.Draws) || 0) + 1;
      normalized2.Draws = (Number(normalized2.Draws) || 0) + 1;
      normalized1.TotalPoints = (Number(normalized1.TotalPoints) || 0) + 1;
      normalized2.TotalPoints = (Number(normalized2.TotalPoints) || 0) + 1;
    }
  });

  if (normalizedMatchCount === 0) {
    return [
      ...sortCategoryStandings(coreRows, tieBreakers),
      ...sortCategoryStandings(extraRows, tieBreakers),
    ];
  }

  return [
    ...sortCategoryStandings(normalizedCoreRows, tieBreakers),
    ...sortCategoryStandings(extraRows, tieBreakers),
  ];
}

export function deriveCategoryPlaceholderAssignments({
  standings = [],
  totalPositions,
  tieBreakers,
  fixtures = [],
}: {
  standings: StandingRow[];
  totalPositions: number;
  tieBreakers?: TieBreakerConfig;
  fixtures?: CategoryFixtureRow[];
}): PlaceholderAssignment[] {
  if (!totalPositions || totalPositions <= 0) return [];

  const ordered = orderCategoryStandingsForOverallGroupOrder(
    standings,
    tieBreakers,
    fixtures
  );
  const placeholders: PlaceholderAssignment[] = [];
  for (let index = 0; index < totalPositions; index += 1) {
    const teamId = ordered[index]?.team ?? null;
    placeholders.push({
      placeholder: `~group:0/p:${index + 1}`,
      teamId,
    });
  }
  return placeholders;
}

export function deriveWorstCategoryPlaceholderAssignments({
  standings = [],
  totalPositions,
  tieBreakers,
  fixtures = [],
}: {
  standings: StandingRow[];
  totalPositions: number;
  tieBreakers?: TieBreakerConfig;
  fixtures?: CategoryFixtureRow[];
}): PlaceholderAssignment[] {
  if (!totalPositions || totalPositions <= 0) return [];

  const ordered = orderCategoryStandingsForOverallGroupOrder(
    standings,
    tieBreakers,
    fixtures
  ).reverse();
  const placeholders: PlaceholderAssignment[] = [];
  for (let index = 0; index < totalPositions; index += 1) {
    const teamId = ordered[index]?.team ?? null;
    placeholders.push({
      placeholder: `~worst:${index + 1}/p:0`,
      teamId,
    });
  }
  return placeholders;
}
