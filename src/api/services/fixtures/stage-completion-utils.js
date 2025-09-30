const DEFAULT_TIE_BREAKERS = {
  totalPoints: (row) => Number(row?.TotalPoints) || 0,
  pointsDifference: (row) => Number(row?.PointsDifference) || 0,
  pointsFrom: (row) => Number(row?.PointsFrom) || 0,
  groupNumber: (row) => Number(row?.grp) || 0,
};

function deriveBestPlaceholderAssignments({
  position,
  standings = [],
  tieBreakers,
}) {
  if (!position || position <= 0) return [];

  const ordered = sortCategoryStandings(standings, tieBreakers);
  return ordered.map((row, index) => ({
    placeholder: `~best:${index + 1}/p:${position}`,
    teamId: row?.team ?? null,
  }));
}

function planGroupZeroAssignments({
  remainingMatches,
  standings = [],
  totalPositions,
  tieBreakers,
}) {
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
      remainingMatches,
      assignments: [],
    };
  }

  const assignments = deriveCategoryPlaceholderAssignments({
    standings,
    totalPositions,
    tieBreakers,
  });

  return {
    shouldSkip: false,
    reason: 'assign',
    remainingMatches: 0,
    assignments,
  };
}

function evaluatePlaceholderDelta({
  tournamentId,
  category,
  teamField,
  placeholder,
  beforeRows = [],
  afterRows = [],
}) {
  const entries = [];

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

function deriveGroupPlaceholderAssignments({
  stage,
  groupNumber,
  totalPositions,
  standings = [],
}) {
  if (!totalPositions || totalPositions <= 0) return [];

  const placeholders = [];
  for (let index = 0; index < totalPositions; index += 1) {
    const teamId = standings[index]?.team ?? null;
    placeholders.push({
      placeholder: `~${stage}:${groupNumber}/p:${index + 1}`,
      teamId,
    });
  }
  return placeholders;
}

function sortCategoryStandings(
  standings = [],
  tieBreakers = DEFAULT_TIE_BREAKERS
) {
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

function deriveCategoryPlaceholderAssignments({
  standings = [],
  totalPositions,
  tieBreakers,
}) {
  if (!totalPositions || totalPositions <= 0) return [];

  const ordered = sortCategoryStandings(standings, tieBreakers);
  const placeholders = [];
  for (let index = 0; index < totalPositions; index += 1) {
    const teamId = ordered[index]?.team ?? null;
    placeholders.push({
      placeholder: `~group:0/p:${index + 1}`,
      teamId,
    });
  }
  return placeholders;
}

module.exports = {
  deriveGroupPlaceholderAssignments,
  deriveCategoryPlaceholderAssignments,
  sortCategoryStandings,
  evaluatePlaceholderDelta,
  deriveBestPlaceholderAssignments,
  planGroupZeroAssignments,
};
