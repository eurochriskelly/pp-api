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
        `SELECT DISTINCT CASE WHEN subregion IS NOT NULL AND subregion <> '' 
         THEN CONCAT(region, '%', subregion) ELSE region END AS formatted_region 
         FROM clubs`
      );
      return rows.map(row => {
        const regionName = row.formatted_region;
        const hash = crypto.createHash('md5').update(regionName).digest('hex');
        return { id: hash, name: regionName };
      });
    },

    listRegionInfo: async (region, { sex, sport, level }) => {
      const { region: reg, subregion } = splitRegion(region);
      let constraints = [`region = ?`];
      const params = [reg];
      if (subregion) {
        constraints.push(`subregion = ?`);
        params.push(subregion);
      }
      if (sex) constraints.push(sex === "male" ? `category IN ('gaa', 'hurling')` : `category IN ('lgfa', 'camogie')`);
      if (sport) {
        const sportMap = {
          hurling: `'hurling', 'camogie', 'youthhurling'`,
          football: `'gaa', 'lgfa', 'youthfootball'`,
          handball: `'handball'`,
          rounders: `'rounders'`,
        };
        if (sportMap[sport]) constraints.push(`category IN (${sportMap[sport]})`);
      }
      if (level) constraints.push(level === "youth" ? `category IN ('youthhurling', 'youthfootball')` : `category IN ('gaa', 'lgfa', 'hurling', 'camogie', 'handball', 'rounders')`);
      
      const rows = await select(
        `SELECT * FROM v_club_teams WHERE ${constraints.join(" AND ")}`,
        params
      );
      return { header: { count: rows.length, region: reg, subregion }, data: rows };
    }
  };
};
