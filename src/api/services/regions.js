const crypto = require('crypto');
const { II, DD } = require('../../lib/logging');
const dbHelper = require('../../lib/db-helper');

function splitRegion(rIn) {
  const parts = rIn.split('%');
  return { region: parts[0], subregion: parts.length > 1 ? parts[1] : null };
}

module.exports = (db) => {
  const { select } = dbHelper(db);

  return {
    listRegions: async () => {
      const rows = await select(
        `SELECT
           c.region,
           c.subregion,
           COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as activeClubsCount,
           COUNT(DISTINCT t.id) as activeTeamsCount
         FROM clubs c
         LEFT JOIN teams t ON t.clubId = c.id AND t.status = 'active'
         GROUP BY c.region, c.subregion
         ORDER BY c.region, c.subregion`
      );
      return rows.map(row => {
        const regionName = (row.subregion && row.subregion !== '') ? `${row.region}%${row.subregion}` : row.region;
        const hash = crypto.createHash('md5').update(regionName).digest('hex');
        return {
          id: hash,
          name: regionName,
          activeClubsCount: parseInt(row.activeClubsCount, 10) || 0,
          activeTeamsCount: parseInt(row.activeTeamsCount, 10) || 0
        };
      });
    },

    listRegionInfo: async (regionString, { sex, sport, level }) => {
      const { region: reg, subregion } = splitRegion(regionString);

      // Constraints for fetching team data from v_club_teams
      // Assumes v_club_teams has columns: region, subregion, club_status, team_status, category
      let teamSelectionConstraints = [`region = ?`];
      const teamSelectionParams = [reg];

      if (subregion) {
        teamSelectionConstraints.push(`subregion = ?`);
        teamSelectionParams.push(subregion);
      } else {
        teamSelectionConstraints.push(`(subregion IS NULL OR subregion = '')`);
      }
      teamSelectionConstraints.push(`club_status = 'active'`); // Filter for active clubs associated with teams
      teamSelectionConstraints.push(`team_status = 'active'`); // Filter for active teams

      if (sex) teamSelectionConstraints.push(sex === "male" ? `category IN ('gaa', 'hurling')` : `category IN ('lgfa', 'camogie')`);
      if (sport) {
        const sportMap = {
          hurling: `'hurling', 'camogie', 'youthhurling'`,
          football: `'gaa', 'lgfa', 'youthfootball'`,
          handball: `'handball'`,
          rounders: `'rounders'`,
        };
        if (sportMap[sport]) teamSelectionConstraints.push(`category IN (${sportMap[sport]})`);
      }
      if (level) teamSelectionConstraints.push(level === "youth" ? `category IN ('youthhurling', 'youthfootball')` : `category IN ('gaa', 'lgfa', 'hurling', 'camogie', 'handball', 'rounders')`);
      
      const teamDataRows = await select(
        `SELECT * FROM v_club_teams WHERE ${teamSelectionConstraints.join(" AND ")}`,
        teamSelectionParams
      );

      // Constraints for counting active clubs in the specified region/subregion
      let clubCountConstraints = [`region = ?`, `status = 'active'`];
      const clubCountParams = [reg];
      if (subregion) {
        clubCountConstraints.push(`subregion = ?`);
        clubCountParams.push(subregion);
      } else {
        clubCountConstraints.push(`(subregion IS NULL OR subregion = '')`);
      }
      
      const [activeClubsStats] = await select(
        `SELECT COUNT(DISTINCT id) as count FROM clubs WHERE ${clubCountConstraints.join(" AND ")}`,
        clubCountParams
      );
      
      return { 
        header: { 
          region: reg, 
          subregion,
          activeClubsCount: parseInt(activeClubsStats.count, 10) || 0,
          activeTeamsCount: teamDataRows.length 
        }, 
        data: teamDataRows 
      };
    }
  };
};
