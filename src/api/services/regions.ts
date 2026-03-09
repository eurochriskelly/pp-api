import crypto = require('crypto');
import dbHelper = require('../../lib/db-helper');

interface Region {
  id: string;
  name: string;
  activeClubsCount: number;
  activeTeamsCount: number;
}

interface RegionInfoHeader {
  region: string;
  activeClubsCount: number;
  activeTeamsCount: number;
}

interface ClubTeam {
  [key: string]: unknown;
}

interface RegionInfo {
  header: RegionInfoHeader;
  data: ClubTeam[];
}

interface RegionClub {
  clubId: number;
  clubName: string;
  country: string;
  city: string;
  region: string;
  subregion: string;
  status: string;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

interface RegionsService {
  listRegions: () => Promise<Region[]>;
  listRegionInfo: (
    regionString: string,
    options: { sex?: string; sport?: string; level?: string }
  ) => Promise<RegionInfo>;
  listRegionClubs: (regionString: string) => Promise<RegionClub[]>;
}

function regionsService(db: DbConnection): RegionsService {
  const { select } = dbHelper(db as any);

  return {
    listRegions: async (): Promise<Region[]> => {
      const rows = (await select(
        `SELECT
           c.region,
           c.subregion,
           COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.clubId END) as activeClubsCount,
           COUNT(DISTINCT t.teamId) as activeTeamsCount
         FROM clubs c
         LEFT JOIN clubTeams t ON t.clubId = c.clubId AND t.status = 'active'
         GROUP BY c.region, c.subregion
         ORDER BY c.region, c.subregion`
      )) as unknown as {
        region: string;
        subregion: string;
        activeClubsCount: string;
        activeTeamsCount: string;
      }[];
      return rows
        .filter((row) => row.region != null)
        .map((row) => {
          const regionName =
            row.subregion && row.subregion !== ''
              ? `${row.region}%${row.subregion}`
              : row.region;
          const hash = crypto
            .createHash('md5')
            .update(regionName)
            .digest('hex');
          return {
            id: hash,
            name: encodeURI(regionName),
            activeClubsCount: parseInt(row.activeClubsCount, 10) || 0,
            activeTeamsCount: parseInt(row.activeTeamsCount, 10) || 0,
          };
        });
    },

    // FIXME: this should handle sub regions too
    listRegionInfo: async (
      regionString: string,
      { sex, sport, level }: { sex?: string; sport?: string; level?: string }
    ): Promise<RegionInfo> => {
      // Constraints for fetching team data from v_club_teams
      // Assumes v_club_teams has columns: region, subregion, status, team_status, category
      const teamSelectionConstraints: string[] = [`region = ?`];
      const teamSelectionParams: (string | number)[] = [regionString];

      teamSelectionConstraints.push(`clubStatus = 'active'`); // Filter for active clubs associated with teams
      teamSelectionConstraints.push(`teamStatus = 'active'`); // Filter for active teams

      if (sex)
        teamSelectionConstraints.push(
          sex === 'male'
            ? `category IN ('gaa', 'hurling')`
            : `category IN ('lgfa', 'camogie')`
        );
      if (sport) {
        const sportMap: { [key: string]: string } = {
          hurling: `'hurling', 'camogie', 'youthhurling'`,
          football: `'gaa', 'lgfa', 'youthfootball'`,
          handball: `'handball'`,
          rounders: `'rounders'`,
        };
        if (sportMap[sport])
          teamSelectionConstraints.push(`category IN (${sportMap[sport]})`);
      }
      if (level)
        teamSelectionConstraints.push(
          level === 'youth'
            ? `category IN ('youthhurling', 'youthfootball')`
            : `category IN ('gaa', 'lgfa', 'hurling', 'camogie', 'handball', 'rounders')`
        );

      const teamDataRows = (await select(
        `SELECT * FROM v_club_teams WHERE ${teamSelectionConstraints.join(' AND ')}`,
        teamSelectionParams
      )) as unknown as ClubTeam[];

      // Assuming 'clubs' table has 'status' and 'clubId'
      const clubCountConstraints = [`region = ?`, `status = 'active'`];
      const clubCountParams: (string | number)[] = [regionString];

      const [activeClubsStats] = (await select(
        `SELECT COUNT(DISTINCT clubId) as count FROM clubs WHERE ${clubCountConstraints.join(' AND ')}`,
        clubCountParams
      )) as unknown as { count: string }[];

      return {
        header: {
          region: regionString,
          activeClubsCount: parseInt(activeClubsStats.count, 10) || 0,
          activeTeamsCount: teamDataRows.length,
        },
        data: teamDataRows,
      };
    },

    listRegionClubs: async (regionString: string): Promise<RegionClub[]> => {
      const rows = (await select(
        `SELECT clubId, clubName, country, city, region, subregion, status
         FROM clubs
         WHERE region = ? AND status = 'active'
         ORDER BY clubName`,
        [regionString]
      )) as unknown as RegionClub[];
      return rows;
    },
  };
}

export = regionsService;
