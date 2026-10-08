// Materialize concrete fixture participants into the durable competition roster.
// Existing names, suffixes, and allocations are never overwritten.
export const synchronizeRoster = async (helper: any, tournamentId: number) => {
  await helper.transaction(async (tx: any) => {
    await tx.insert(
      `INSERT IGNORE INTO tournament_competitions (tournamentId, name)
      SELECT DISTINCT tournamentId, TRIM(category) FROM fixtures
      WHERE tournamentId = ? AND NULLIF(TRIM(category), '') IS NOT NULL`,
      [tournamentId]
    );
    await tx.insert(
      `INSERT IGNORE INTO tournament_teams
      (tournamentId, competitionId, entrantId, teamName, teamType, teamSuffix)
      SELECT DISTINCT p.tournamentId, c.id, NULL, p.teamName, 'primary',
        CASE WHEN p.teamName NOT LIKE '%/%' AND p.teamName REGEXP ' [AB]$' THEN RIGHT(p.teamName, 1) ELSE NULL END
      FROM (
        SELECT tournamentId, TRIM(category) AS competition, team1Id AS teamName FROM fixtures WHERE tournamentId = ?
        UNION SELECT tournamentId, TRIM(category), team2Id FROM fixtures WHERE tournamentId = ?
      ) p JOIN tournament_competitions c ON c.tournamentId = p.tournamentId AND c.name = p.competition
      LEFT JOIN tournament_teams t ON t.competitionId = c.id AND t.teamName = p.teamName
      WHERE t.id IS NULL AND NULLIF(TRIM(p.teamName), '') IS NOT NULL AND p.teamName NOT LIKE '~%'
        AND UPPER(p.teamName) NOT IN ('PENDING', 'CONTESTED', 'BYE', 'TBD')`,
      [tournamentId, tournamentId]
    );
  });
};
