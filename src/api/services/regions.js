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
           COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.clubId END) as activeClubsCount,
           COUNT(DISTINCT t.teamId) as activeTeamsCount
         FROM clubs c
         LEFT JOIN clubTeams t ON t.clubId = c.clubId AND t.status = 'active'
         GROUP BY c.region, c.subregion
         ORDER BY c.region, c.subregion`
      );
      return rows.map(row => {
        const regionName = (row.subregion && row.subregion !== '') ? `${row.region}%${row.subregion}` : row.region;
        const hash = crypto.createHash('md5').update(regionName).digest('hex');
        return {
          id: hash,
          name: encodeURI(regionName),
          activeClubsCount: parseInt(row.activeClubsCount, 10) || 0,
          activeTeamsCount: parseInt(row.activeTeamsCount, 10) || 0
        };
      });
    },
    
    // FIXME: this should handle sub regions too
    listRegionInfo: async (regionString, { sex, sport, level }) => {

      // Constraints for fetching team data from v_club_teams
      // Assumes v_club_teams has columns: region, subregion, status, team_status, category
      let teamSelectionConstraints = [`region = ?`];
      const teamSelectionParams = [regionString];

      teamSelectionConstraints.push(`clubStatus = 'active'`); // Filter for active clubs associated with teams
      teamSelectionConstraints.push(`teamStatus = 'active'`); // Filter for active teams

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

      // Assuming 'clubs' table has 'status' and 'clubId'
      let clubCountConstraints = [`region = ?`, `status = 'active'`];
      const clubCountParams = [regionString];
      
      const [activeClubsStats] = await select(
        `SELECT COUNT(DISTINCT clubId) as count FROM clubs WHERE ${clubCountConstraints.join(" AND ")}`,
        clubCountParams
      );
      
      return { 
        header: { 
          region: regionString, 
          activeClubsCount: parseInt(activeClubsStats.count, 10) || 0,
          activeTeamsCount: teamDataRows.length 
        }, 
        data: teamDataRows 
      };
    }
  };
};
