module.exports = {
  sqlGroupStandings,
  sqlGroupStandingsWithH2H,
  sqlGroupRankings: (
    rank = 1,
    winAward = 2,
    drawAward = 1,
    lossAward = 0,
    goalsPoints = 3,
    pointsPoints = 1
  ) => {
    const standingsQuery = sqlGroupStandings(
      winAward,
      drawAward,
      lossAward,
      goalsPoints,
      pointsPoints
    );
    const query = `
       WITH RankedTeams AS (
        SELECT 
          vgs.category,
          vgs.grp,
          vgs.team,
          vgs.tournamentId,
          vgs.MatchesPlayed,
          vgs.Wins,
          vgs.Draws,
          vgs.Losses,
          vgs.PointsFrom,
          vgs.PointsDifference,
          vgs.TotalPoints,
          ROW_NUMBER() OVER (
            PARTITION BY vgs.category, vgs.grp, vgs.tournamentId
            ORDER BY vgs.TotalPoints DESC, vgs.PointsDifference DESC, vgs.PointsFrom DESC
          ) AS groupRank
        FROM 
          ${standingsQuery}
      )
      SELECT 
        category,
        grp,
        team,
        tournamentId,
        MatchesPlayed,
        Wins,
        Draws,
        Losses,
        PointsFrom,
        PointsDifference,
        TotalPoints
      FROM RankedTeams
      WHERE groupRank = ${rank}
      ORDER BY category DESC, grp, TotalPoints DESC
    `;

    return query;
  },
};

function sqlGroupStandings(
  winAward = 2,
  drawAward = 1,
  lossAward = 0,
  goalsPoints = 3,
  pointsPoints = 1,
  order = true
) {
  const t1Score = `((f.goals1 * ${goalsPoints}) + (f.points1 * ${pointsPoints}))`;
  const t2Score = `((f.goals2 * ${goalsPoints}) + (f.points2 * ${pointsPoints}))`;
  const query = `
    (
    SELECT 
        c.category,
        c.grp,
        c.team,
        c.tournamentId,
        SUM(c.MatchesPlayed) AS MatchesPlayed,
        SUM(c.Wins) AS Wins,
        SUM(c.Draws) AS Draws,
        SUM(c.Losses) AS Losses,
        SUM(c.PointsFrom) AS PointsFrom,
        SUM(c.PointsDifference) AS PointsDifference,
        SUM(c.TotalPoints) AS TotalPoints
    FROM (
        -- Stats for team1
        SELECT 
            f.category,
            f.groupNumber AS grp,
            f.team1Id AS team,
            f.tournamentId,
            COUNT(*) AS MatchesPlayed,
            SUM(CASE WHEN ${t1Score} > ${t2Score} THEN 1 ELSE 0 END) AS Wins,
            SUM(CASE WHEN ${t1Score} = ${t2Score} THEN 1 ELSE 0 END) AS Draws,
            SUM(CASE WHEN ${t1Score} < ${t2Score} THEN 1 ELSE 0 END) AS Losses,
            SUM(${t1Score}) AS PointsFrom,
            SUM(${t1Score} - ${t2Score}) AS PointsDifference,
            SUM(
                CASE 
                    WHEN ${t1Score} > ${t2Score} THEN ${winAward}
                    WHEN ${t1Score} = ${t2Score} THEN ${drawAward} 
                    ELSE ${lossAward} 
                END
            ) AS TotalPoints
        FROM fixtures f
        WHERE f.stage = 'group'
        GROUP BY f.category, f.groupNumber, f.team1Id, f.tournamentId

        UNION ALL

        -- Stats for team2
        SELECT
            f.category,
            f.groupNumber AS grp,
            f.team2Id AS team,
            f.tournamentId,
            COUNT(*) AS MatchesPlayed,
            SUM(CASE WHEN ${t2Score} > ${t1Score} THEN 1 ELSE 0 END) AS Wins,
            SUM(CASE WHEN ${t2Score} = ${t1Score} THEN 1 ELSE 0 END) AS Draws,
            SUM(CASE WHEN ${t2Score} < ${t1Score} THEN 1 ELSE 0 END) AS Losses,
            SUM(${t2Score}) AS PointsFrom,
            SUM(${t2Score} - ${t1Score}) AS PointsDifference,
            SUM(
                CASE 
                    WHEN ${t2Score} > ${t1Score} THEN ${winAward}
                    WHEN ${t2Score} = ${t1Score} THEN ${drawAward} 
                    ELSE ${lossAward} 
                END
            ) AS TotalPoints
        FROM fixtures f
        WHERE f.stage = 'group'
        GROUP BY f.category, f.groupNumber, f.team2Id, f.tournamentId
    ) AS c
    GROUP BY c.category, c.grp, c.team, c.tournamentId
    ${
      order
        ? `
      ORDER BY 
          c.category DESC, 
          c.grp, 
          TotalPoints DESC, 
          PointsDifference DESC, 
          PointsFrom DESC
      `
        : ''
    }
    ) as vgs`;
  return query;
}

/**
 * Generate SQL query for group standings including head-to-head match data
 * This is used with the head-to-head tiebreaker in JavaScript
 * @param {number} winAward - Points for a win (default: 2)
 * @param {number} drawAward - Points for a draw (default: 1)
 * @param {number} lossAward - Points for a loss (default: 0)
 * @param {number} goalsPoints - Points per goal (default: 3)
 * @param {number} pointsPoints - Points per point (default: 1)
 * @returns {string} SQL query string
 */
function sqlGroupStandingsWithH2H(
  winAward = 2,
  drawAward = 1,
  lossAward = 0,
  goalsPoints = 3,
  pointsPoints = 1
) {
  const t1Score = `((f.goals1 * ${goalsPoints}) + (f.points1 * ${pointsPoints}))`;
  const t2Score = `((f.goals2 * ${goalsPoints}) + (f.points2 * ${pointsPoints}))`;

  const standingsQuery = sqlGroupStandings(
    winAward,
    drawAward,
    lossAward,
    goalsPoints,
    pointsPoints,
    false
  );

  // Remove the outer wrapper and alias for use in CTE
  // The sqlGroupStandings returns: "(...) as vgs", we need just the inner SELECT
  const standingsInnerQuery = standingsQuery
    .replace(/^\s*\(\s*/, '') // Remove opening "("
    .replace(/\s*\)\s*as\s+vgs\s*$/i, ''); // Remove ") as vgs" at end

  const query = `
    WITH BaseStandings AS (
      ${standingsInnerQuery}
    ),
    HeadToHeadMatches AS (
      -- Get all matches between teams in the same group/category/tournament
      SELECT 
        f.category,
        f.groupNumber AS grp,
        f.team1Id AS teamA,
        f.team2Id AS teamB,
        ${t1Score} AS scoreA,
        ${t2Score} AS scoreB
      FROM fixtures f
      WHERE f.stage = 'group'
        AND f.goals1 IS NOT NULL 
        AND f.goals2 IS NOT NULL
        AND f.outcome NOT IN ('conceded', 'forfeit', 'not played')
    )
    SELECT 
      bs.category,
      bs.grp,
      bs.team,
      bs.tournamentId,
      bs.MatchesPlayed,
      bs.Wins,
      bs.Draws,
      bs.Losses,
      bs.PointsFrom,
      bs.PointsDifference,
      bs.TotalPoints,
      hhm.teamA AS h2hTeamA,
      hhm.teamB AS h2hTeamB,
      hhm.scoreA AS h2hScoreA,
      hhm.scoreB AS h2hScoreB
    FROM BaseStandings bs
    LEFT JOIN HeadToHeadMatches hhm 
      ON (bs.team = hhm.teamA OR bs.team = hhm.teamB)
      AND bs.category = hhm.category 
      AND bs.grp = hhm.grp
    ORDER BY bs.category DESC, bs.grp, bs.TotalPoints DESC, bs.PointsDifference DESC, bs.PointsFrom DESC`;

  return query;
}
