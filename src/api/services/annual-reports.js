const dbHelper = require('../../lib/db-helper');

module.exports = (db) => {
  const dbh = dbHelper(db);

  const getAnnualReport = async (year) => {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      throw new Error('Invalid year');
    }

    const y = year;

    const totalTournamentsRes = await dbh.select(
      `SELECT COUNT(DISTINCT id) as count FROM tournaments WHERE YEAR(Date) = ?`,
      [y]
    );
    const totalTournaments = totalTournamentsRes[0]?.count || 0;

    if (totalTournaments === 0) {
      throw new Error('No data found for year');
    }

    const totalMatchesRes = await dbh.select(
      `SELECT COUNT(*) as count FROM fixtures f JOIN tournaments t ON f.tournamentId = t.id WHERE YEAR(t.Date) = ?`,
      [y]
    );
    const totalMatches = totalMatchesRes[0]?.count || 0;

    const totalTeamsRes = await dbh.select(
      `SELECT COUNT(DISTINCT team) as count FROM (
        SELECT DISTINCT team1Planned as team FROM fixtures f JOIN tournaments t ON f.tournamentId = t.id WHERE YEAR(t.Date) = ? AND team1Planned IS NOT NULL AND team1Planned NOT LIKE '~%'
        UNION
        SELECT DISTINCT team2Planned as team FROM fixtures f JOIN tournaments t ON f.tournamentId = t.id WHERE YEAR(t.Date) = ? AND team2Planned IS NOT NULL AND team2Planned NOT LIKE '~%'
      ) teams`,
      [y, y]
    );
    const totalTeams = totalTeamsRes[0]?.count || 0;

    const totalRegionsRes = await dbh.select(
      `SELECT COUNT(DISTINCT region) as count FROM tournaments WHERE YEAR(Date) = ? AND region IS NOT NULL AND region != ''`,
      [y]
    );
    const totalRegions = totalRegionsRes[0]?.count || 0;

    const avgMatchesPerTournament =
      totalTournaments > 0
        ? Number((totalMatches / totalTournaments).toFixed(1))
        : 0;

    const winMarginRes = await dbh.select(
      `SELECT AVG(ABS(COALESCE(goals1,0) - COALESCE(goals2,0))) as avg_margin, MAX(ABS(COALESCE(goals1,0) - COALESCE(goals2,0))) as max_margin FROM fixtures f JOIN tournaments t ON f.tournamentId = t.id WHERE YEAR(t.Date) = ? AND goals1 IS NOT NULL AND goals2 IS NOT NULL`,
      [y]
    );
    const avgMargin = winMarginRes[0]?.avg_margin
      ? Number(winMarginRes[0].avg_margin.toFixed(1))
      : 0;
    const maxMargin = winMarginRes[0]?.max_margin || 0;

    const monthlyRes = await dbh.select(
      `SELECT MONTH(scheduled) as month_num, COUNT(*) as count FROM fixtures f JOIN tournaments t ON f.tournamentId = t.id WHERE YEAR(t.Date) = ? GROUP BY MONTH(scheduled) ORDER BY month_num`,
      [y]
    );
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyMatches = monthNames.map((month, idx) => ({
      month,
      count: Number(
        monthlyRes.find((m) => Number(m.month_num) === idx + 1)?.count || 0
      ),
    }));

    const topRegionsRes = await dbh.select(
      `SELECT t.region, COUNT(DISTINCT t.id) as tournaments, COUNT(f.id) as matches FROM tournaments t LEFT JOIN fixtures f ON f.tournamentId = t.id WHERE YEAR(t.Date) = ? AND t.region IS NOT NULL AND t.region != '' GROUP BY t.region ORDER BY tournaments DESC LIMIT 5`,
      [y]
    );

    const topSportsRes = await dbh.select(
      `SELECT s.category as sport, COUNT(DISTINCT t.id) as tournaments FROM squads s JOIN tournaments t ON s.tournamentId = t.id WHERE YEAR(t.Date) = ? AND s.category IS NOT NULL AND s.category != '' GROUP BY s.category ORDER BY tournaments DESC LIMIT 5`,
      [y]
    );

    const tournamentsRes = await dbh.select(
      `SELECT t.id, t.Title as name, DATE(t.Date) as date, t.sport as sport, COUNT(f.id) as matches, (SELECT COUNT(DISTINCT team) FROM (SELECT DISTINCT team1Planned as team FROM fixtures WHERE tournamentId = t.id AND team1Planned IS NOT NULL AND team1Planned NOT LIKE '~%' UNION SELECT DISTINCT team2Planned as team FROM fixtures WHERE tournamentId = t.id AND team2Planned IS NOT NULL AND team2Planned NOT LIKE '~%') u) as teams, t.region FROM tournaments t LEFT JOIN fixtures f ON f.tournamentId = t.id WHERE YEAR(t.Date) = ? GROUP BY t.id, t.Title, t.Date, t.region, t.sport ORDER BY t.Date DESC`,
      [y]
    );

    return {
      year: y,
      summary: {
        totalTournaments,
        totalMatches,
        totalTeams,
        totalRegions,
        avgMatchesPerTournament,
        winMarginStats: { avg: avgMargin, max: maxMargin },
      },
      monthlyMatches,
      topRegions: topRegionsRes,
      topSports: topSportsRes,
      tournaments: tournamentsRes,
    };
  };

  const getYearsSummary = async () => {
    const yearsRes = await dbh.select(
      `SELECT YEAR(t.Date) as year, COUNT(DISTINCT t.id) as tournaments, COUNT(f.id) as matches, COUNT(DISTINCT teams.team) as teams FROM tournaments t LEFT JOIN fixtures f ON f.tournamentId = t.id LEFT JOIN (SELECT DISTINCT team1Planned as team, tournamentId FROM fixtures WHERE team1Planned IS NOT NULL AND team1Planned NOT LIKE '~%' UNION SELECT DISTINCT team2Planned as team, tournamentId FROM fixtures WHERE team2Planned IS NOT NULL AND team2Planned NOT LIKE '~%') teams ON teams.tournamentId = t.id WHERE t.Date IS NOT NULL GROUP BY YEAR(t.Date) HAVING tournaments > 0 ORDER BY year DESC`
    );
    return yearsRes;
  };

  return { getAnnualReport, getYearsSummary };
};
