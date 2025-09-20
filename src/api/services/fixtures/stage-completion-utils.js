const DEFAULT_TIE_BREAKERS = {
  totalPoints: (row) => Number(row?.TotalPoints) || 0,
  pointsDifference: (row) => Number(row?.PointsDifference) || 0,
  pointsFrom: (row) => Number(row?.PointsFrom) || 0,
  groupNumber: (row) => Number(row?.grp) || 0,
};

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

function sortCategoryStandings(standings = [], tieBreakers = DEFAULT_TIE_BREAKERS) {
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
};
