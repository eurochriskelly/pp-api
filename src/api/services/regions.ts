import crypto = require('crypto');
import dbHelper = require('../../lib/db-helper');

interface Region {
  id: string;
  name: string;
  region: string;
  subregion: string | null;
  activeClubsCount: number;
  supportedSportsCount: number;
}

interface RegionInfoHeader {
  region: string;
  subregion: string | null;
  count: number;
  activeClubsCount: number;
  supportedSportsCount: number;
}

interface ClubTeam {
  [key: string]: unknown;
}

type ClubDataSource = 'gge' | 'local';

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

interface ImportedClubPayload {
  sports_supported?: string[];
  source_record?: { sportsSupported?: string[] };
}

interface ImportedClub extends RegionClub {
  payload: string | ImportedClubPayload;
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
    options: {
      sex?: string;
      sport?: string;
      level?: string;
      subregion?: string;
    }
  ) => Promise<RegionInfo>;
  listRegionClubs: (regionString: string) => Promise<RegionClub[]>;
}

function regionsService(db: DbConnection): RegionsService {
  const { select } = dbHelper(db as any);

  const importedSportCategories = (payload: ImportedClub['payload']) => {
    const source: ImportedClubPayload =
      typeof payload === 'string' ? JSON.parse(payload) : payload;
    const mapping: Record<string, string> = {
      Mens_Football: 'gaa',
      mensFootball: 'gaa',
      LGFA: 'lgfa',
      lgfa: 'lgfa',
      Hurling: 'hurling',
      hurling: 'hurling',
      Camogie: 'camogie',
      camogie: 'camogie',
      Handball: 'handball',
      handball: 'handball',
      Youth: 'youthfootball',
      youth: 'youthfootball',
    };
    return [
      ...new Set(
        (source.sports_supported || source.source_record?.sportsSupported || [])
          .map((sport) => mapping[sport])
          .filter((sport): sport is string => Boolean(sport))
      ),
    ];
  };

  return {
    listRegions: async (): Promise<Region[]> => {
      const rows = (await select(
        `SELECT
           c.region,
           c.subregion,
           g.payload
         FROM clubs c
         INNER JOIN gge_import_clubs g ON g.clubId = c.clubId
         WHERE c.status = 'active'
         ORDER BY c.region, c.subregion`
      )) as unknown as {
        region: string;
        subregion: string;
        payload: ImportedClub['payload'];
      }[];
      const grouped = new Map<
        string,
        {
          region: string;
          subregion: string | null;
          activeClubsCount: number;
          supportedSportsCount: number;
        }
      >();
      rows
        .filter((row) => row.region != null)
        .forEach((row) => {
          const subregion = row.subregion || null;
          const key = `${row.region}::${subregion || ''}`;
          const existing = grouped.get(key) || {
            region: row.region,
            subregion,
            activeClubsCount: 0,
            supportedSportsCount: 0,
          };
          existing.activeClubsCount += 1;
          existing.supportedSportsCount += importedSportCategories(
            row.payload
          ).length;
          grouped.set(key, existing);
        });
      return [...grouped.values()]
        .sort((left, right) =>
          `${left.region}/${left.subregion || ''}`.localeCompare(
            `${right.region}/${right.subregion || ''}`
          )
        )
        .map((row) => {
          const regionName =
            row.subregion && row.subregion !== ''
              ? `${row.region} / ${row.subregion}`
              : row.region;
          const hash = crypto
            .createHash('md5')
            .update(regionName)
            .digest('hex');
          return {
            id: hash,
            name: regionName,
            region: row.region,
            subregion: row.subregion || null,
            activeClubsCount: row.activeClubsCount,
            supportedSportsCount: row.supportedSportsCount,
          };
        });
    },

    listRegionInfo: async (
      regionString: string,
      {
        sex,
        sport,
        level,
        subregion,
      }: { sex?: string; sport?: string; level?: string; subregion?: string }
    ): Promise<RegionInfo> => {
      const clubSelectionConstraints = [`c.region = ?`, `c.status = 'active'`];
      const clubSelectionParams: string[] = [regionString];
      if (subregion) {
        clubSelectionConstraints.push(`c.subregion = ?`);
        clubSelectionParams.push(subregion);
      } else {
        clubSelectionConstraints.push(
          `(c.subregion IS NULL OR c.subregion = '')`
        );
      }
      const clubs = (await select(
        `SELECT c.clubId, c.clubName, c.country, c.city, c.region, c.subregion, c.status, g.payload
         FROM clubs c
         INNER JOIN gge_import_clubs g ON g.clubId = c.clubId
         WHERE ${clubSelectionConstraints.join(' AND ')}
         ORDER BY c.clubName`,
        clubSelectionParams
      )) as unknown as ImportedClub[];
      const clubData = clubs.flatMap((club) => {
        const categories = importedSportCategories(club.payload);
        const { payload, ...clubDetails } = club;
        return (categories.length ? categories : ['__unregistered__']).map(
          (category) => ({
            ...clubDetails,
            category,
            teamId: null,
            teamName: null,
            teamStatus: category === '__unregistered__' ? null : 'supported',
            clubStatus: club.status,
            dataSource: 'gge' as ClubDataSource,
          })
        );
      });

      return {
        header: {
          region: regionString,
          subregion: subregion || null,
          count: clubs.length,
          activeClubsCount: clubs.length,
          supportedSportsCount: clubData.filter(
            (club) => club.category !== '__unregistered__'
          ).length,
        },
        data: clubData,
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
