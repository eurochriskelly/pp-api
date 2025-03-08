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
  }
}

