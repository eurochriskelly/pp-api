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

    listRegionInfo: async (regionIdentifier, { sex, sport, level }) => {
      let regionName = regionIdentifier;

      // Check if regionIdentifier is likely an ID (32-char hex string)
      const isLikelyId = /^[a-f0-9]{32}$/i.test(regionIdentifier);

      if (isLikelyId) {
        II(`Region identifier [${regionIdentifier}] looks like an ID. Attempting to resolve.`);
        const allRegions = await this.listRegions(); // `this` refers to the object being returned
        const foundRegion = allRegions.find(r => r.id === regionIdentifier);
        if (foundRegion) {
          regionName = foundRegion.name;
          DD(`Resolved ID [${regionIdentifier}] to name [${regionName}].`);
        } else {
          II(`Region ID [${regionIdentifier}] not found.`);
          const error = new Error(`Region with ID ${regionIdentifier} not found`);
          error.status = 404; // Standard way to suggest a status code for error middleware
          throw error;
        }
      }

      const { region: reg, subregion } = splitRegion(regionName);
      // If regionName (from a non-ID identifier, or resolved from ID) is invalid,
      // the subsequent DB query might return no results. This is fine and should result
      // in an empty list of clubs/teams, not necessarily a 404 unless the name itself is considered non-existent.
      // The 404 is specifically for when an ID is given and that ID does not map to any known region.
      // If a name is given that doesn't exist, splitRegion will still process it, and the DB query
      // will likely return empty results, leading to a 200 OK with empty data.

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
