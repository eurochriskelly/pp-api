module.exports = {
  calculateRankings: async (tournamentId, category, select)  => {
    const groupData = {};
    let rankings = [];
    let q = ` select * from v_group_standings where tournamentId=${tournamentId} and category = '${category}'`;
    const standings = (await select(q)).data;
    // generate group counts
    const groups = new Set();
    standings.forEach((s) => {
      groups.add(s.grp);
      if (!groupData.hasOwnProperty(`g${s.grp}`)) {
        groupData[`g${s.grp}`] = 1;
      } else {
        groupData[`g${s.grp}`] += 1;
      }
    });
    // include average points
    standings.forEach((s) => {
      s.PointsDifferenceAverage = s.PointsDifference / groupData[`g${s.grp}`];
    });
    // Now build rankings table
    let group = 1;
    let place = 1;
    standings.forEach((s) => {
      if (s.grp !== group) {
        place = 1;
        group++;
      }
      rankings.push({
        id: s.id,
        team: s.team,
        place: place++,
        pda: s.PointsDifferenceAverage,
      });
    });
    // sort rankings
    rankings = rankings
      .sort((a, b) => (a.pda > b.pda ? -1 : a.pda < b.pda ? 1 : 0))
      .sort((a, b) => (a.place > b.place ? 1 : a.place < b.place ? -1 : 0));
    console.table(rankings);
    return rankings;
  },
  sqlGroupStandings: (
    winAward = 2, drawAward = 1, lossAward = 0,
    goalsPoints = 3, pointsPoints = 1
  )  => {
    const t1Score = `((f.goals1 * ${goalsPoints}) + (f.points1 * ${pointsPoints}))`
    const t2Score = `((f.goals1 * ${goalsPoints}) + (f.points1 * ${pointsPoints}))`
    return `(
      SELECT 
          combined.category AS category,
          combined.grp AS grp,
          combined.team AS team,
          combined.tournamentId AS tournamentId,
          SUM(combined.MatchesPlayed) AS MatchesPlayed,
          SUM(combined.Wins) AS Wins,
          SUM(combined.Draws) AS Draws,
          SUM(combined.Losses) AS Losses,
          SUM(combined.PointsFrom) AS PointsFrom,
          SUM(combined.PointsDifference) AS PointsDifference,
          SUM(combined.TotalPoints) AS TotalPoints
      FROM (
          -- Stats for Team 1
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
          FROM AccTourno.fixtures f
          WHERE f.stage = 'group'
          GROUP BY f.category, f.groupNumber, f.team1Id, f.tournamentId

          UNION ALL

          -- Stats for Team 2
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
          FROM EuroTourno.fixtures f
          WHERE f.stage = 'group'
          GROUP BY f.category, f.groupNumber, f.team2Id, f.tournamentId
      ) combined
      GROUP BY combined.category, combined.grp, combined.team, combined.tournamentId
      ORDER BY combined.category DESC, combined.grp, TotalPoints DESC, PointsDifference DESC, PointsFrom DESC

     ) as vgs `
  }
}


