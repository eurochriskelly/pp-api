import { friendlyTeamLabel } from './utils/teamFormatting';
import {
  calcBracket,
  calcStage,
  getMatchStatus,
  generateMatchLabel,
} from './utils/stageFormatting';
import { calculateStandings } from './utils/standingsCalculation';
import { calculateTeamSummary } from './utils/teamSummaryCalculation';
import { calculateFinalRankings } from './utils/finalRankingsCalculation';
import { InitialGenerator } from '../../fixtures/enhance-fixture/initial-generator';
import { calculateAggregateMatchScore } from '../../../../lib/match-score';

export interface SelectFunction {
  (sql: string, params?: any[]): Promise<any[]>;
}

export interface TournamentInfo {
  eventUuid: string;
  status: string;
  date: string;
  title: string;
  season: string;
  location: {
    region: string;
    address: string;
    lat: number;
    lon: number;
  };
  pointsFor: {
    win: number;
    draw: number;
    loss: number;
  };
}

export interface CategoryInfo {
  category: string;
  allTeams: string[];
  byGroup: Array<{ group: number; teams: string[] }>;
  byBracket: Array<{ bracket: string; teams: string[] }>;
}

export interface Card {
  playerNumber: string;
  playerName: string;
  team: string;
  cardColor: string;
}

export interface ReportData {
  tournamentId: number;
  lastUpdate: string | null;
  tournament: TournamentInfo | null;
  pitches: any[];
  categories: CategoryReport[];
}

export interface CategoryReport {
  category: string;
  initials: string;
  teams: {
    allTeams: string[];
    byGroup: Array<{ group: number; teams: string[] }>;
    byBracket: Array<{ bracket: string; teams: string[] }>;
    summary: any[];
  };
  fixtures: any;
  standings: any;
  rankings: any[];
}

export class ReportBuilder {
  private select: SelectFunction;
  private initialGenerator: InitialGenerator;

  constructor(select: SelectFunction) {
    this.select = select;
    this.initialGenerator = new InitialGenerator();
  }

  async build(tournamentId: number, category?: string): Promise<ReportData> {
    const tournament = await this.getTournamentInfo(tournamentId);
    const pitches = await this.getPitchInfo(tournamentId);
    const categoryTeamInfo = await this.getCategoriesInfo(tournamentId);
    const cardsByFixtureId = await this.getCardsForTournament(tournamentId);

    const filteredCategoryTeamInfo = category
      ? categoryTeamInfo.filter(
          (catInfo) => catInfo.category.toUpperCase() === category.toUpperCase()
        )
      : categoryTeamInfo;

    const categoryInitials = new Map<string, string>();
    for (const catInfo of categoryTeamInfo) {
      const initial = this.initialGenerator.generateInitial(catInfo.category);
      const resolvedInitial = this.initialGenerator.resolveConflict(
        catInfo.category,
        initial,
        () => {} // no-op logger
      );
      categoryInitials.set(catInfo.category, resolvedInitial);
    }

    const categoriesWithFixtures = await Promise.all(
      filteredCategoryTeamInfo.map(async (catInfo) => {
        const fixtures = await this.getFixturesForCategory(
          tournamentId,
          catInfo.category,
          cardsByFixtureId
        );
        const standings = calculateStandings(
          fixtures,
          catInfo.byGroup,
          tournament!.pointsFor
        );
        const teamSummary = calculateTeamSummary(
          catInfo.allTeams,
          fixtures,
          catInfo.byGroup,
          catInfo.byBracket,
          standings
        );

        const rankings = calculateFinalRankings(
          fixtures,
          catInfo.byBracket,
          catInfo.byGroup,
          standings.allGroups
        );

        return {
          category: catInfo.category,
          initials: categoryInitials.get(catInfo.category)!,
          teams: {
            allTeams: catInfo.allTeams,
            byGroup: catInfo.byGroup,
            byBracket: catInfo.byBracket,
            summary: teamSummary,
          },
          fixtures: fixtures,
          standings: standings,
          rankings: rankings,
        };
      })
    );

    let lastUpdate: string | null = null;
    for (const categoryData of categoriesWithFixtures) {
      const categoryLastUpdated = categoryData?.fixtures?.lastUpdated;
      if (
        categoryLastUpdated &&
        (!lastUpdate || new Date(categoryLastUpdated) > new Date(lastUpdate))
      ) {
        lastUpdate = categoryLastUpdated;
      }
    }

    return {
      tournamentId,
      lastUpdate,
      tournament,
      pitches,
      categories: categoriesWithFixtures,
    };
  }

  async getCardsForTournament(
    tournamentId: number
  ): Promise<Map<number, Card[]>> {
    const cards = await this.select(
      `SELECT fixtureId, playerNumber, playerName, team, cardColor 
       FROM cards 
       WHERE tournamentId = ? AND fixtureId IS NOT NULL`,
      [tournamentId]
    );

    const cardsByFixtureId = new Map<number, Card[]>();
    cards.forEach((card: any) => {
      if (!cardsByFixtureId.has(card.fixtureId)) {
        cardsByFixtureId.set(card.fixtureId, []);
      }
      cardsByFixtureId.get(card.fixtureId)!.push({
        playerNumber: card.playerNumber,
        playerName: card.playerName,
        team: card.team,
        cardColor: card.cardColor,
      });
    });
    return cardsByFixtureId;
  }

  async getCategoriesInfo(tournamentId: number): Promise<CategoryInfo[]> {
    const categoryRows = await this.select(
      `SELECT DISTINCT category FROM fixtures WHERE tournamentId=? ORDER BY category`,
      [tournamentId]
    );

    const categoryPromises = categoryRows.map(async (catRow: any) => {
      const category = catRow.category;

      const allTeamsResult = await this.select(
        `
        SELECT DISTINCT team FROM (
          SELECT team1Id as team FROM fixtures 
          WHERE tournamentId=? AND category=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
          UNION 
          SELECT team2Id as team FROM fixtures 
          WHERE tournamentId=? AND category=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
        ) AS combined_teams ORDER BY team
      `,
        [tournamentId, category, tournamentId, category]
      );
      const allTeams = allTeamsResult.map((t: any) => t.team);

      const groupNumberRows = await this.select(
        `
        SELECT DISTINCT groupNumber FROM fixtures 
        WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber IS NOT NULL 
        ORDER BY groupNumber
      `,
        [tournamentId, category]
      );

      const groupPromises = groupNumberRows.map(async (groupRow: any) => {
        const groupNumber = groupRow.groupNumber;
        const groupTeamsResult = await this.select(
          `
          SELECT DISTINCT team FROM (
            SELECT team1Id as team FROM fixtures 
            WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber=? AND team1Id IS NOT NULL AND team1Id NOT LIKE '~%'
            UNION 
            SELECT team2Id as team FROM fixtures 
            WHERE tournamentId=? AND category=? AND stage='group' AND groupNumber=? AND team2Id IS NOT NULL AND team2Id NOT LIKE '~%'
          ) AS group_teams ORDER BY team
        `,
          [
            tournamentId,
            category,
            groupNumber,
            tournamentId,
            category,
            groupNumber,
          ]
        );

        return {
          group: groupNumber,
          teams: groupTeamsResult.map((t: any) => t.team),
        };
      });

      const byGroup = await Promise.all(groupPromises);

      const bracketFixtures = await this.select(
        `
        SELECT stage, team1Id, team2Id 
        FROM fixtures 
        WHERE tournamentId=? AND category=? AND stage != 'group'
      `,
        [tournamentId, category]
      );

      const teamsByBracketMap = new Map<string, Set<string>>();
      const teamsInAnyBracket = new Set<string>();

      bracketFixtures.forEach((fixture: any) => {
        const bracketName = calcBracket(fixture.stage);
        if (bracketName === 'group' || bracketName === 'Unknown') return;

        if (!teamsByBracketMap.has(bracketName)) {
          teamsByBracketMap.set(bracketName, new Set());
        }
        const bracketTeamsSet = teamsByBracketMap.get(bracketName)!;

        if (fixture.team1Id && !fixture.team1Id.startsWith('~')) {
          bracketTeamsSet.add(fixture.team1Id);
          teamsInAnyBracket.add(fixture.team1Id);
        }
        if (fixture.team2Id && !fixture.team2Id.startsWith('~')) {
          bracketTeamsSet.add(fixture.team2Id);
          teamsInAnyBracket.add(fixture.team2Id);
        }
      });

      const noneBracketTeams = allTeams.filter(
        (team) => !teamsInAnyBracket.has(team)
      );
      if (noneBracketTeams.length > 0) {
        teamsByBracketMap.set('None', new Set(noneBracketTeams));
      }

      const byBracket: Array<{ bracket: string; teams: string[] }> = [];
      for (const [bracket, teamsSet] of teamsByBracketMap.entries()) {
        byBracket.push({
          bracket: bracket,
          teams: Array.from(teamsSet).sort(),
        });
      }
      byBracket.sort((a, b) => a.bracket.localeCompare(b.bracket));

      return {
        category: category,
        allTeams: allTeams,
        byGroup: byGroup,
        byBracket: byBracket,
      };
    });

    return Promise.all(categoryPromises);
  }

  async getFixturesForCategory(
    tournamentId: number,
    category: string,
    cardsByFixtureId: Map<number, Card[]>
  ): Promise<any> {
    const fixturesData = await this.select(
      `
      SELECT 
        id, tournamentId, category, groupNumber, stage, 
        pitchPlanned, pitch, 
        scheduledPlanned, scheduled, started, ended, durationPlanned,
        team1Planned, team1Id as team1, team2Planned, team2Id as team2, 
        goals1, points1, goals1Extra, points1Extra, goals1Penalties, 
        goals2, points2, goals2Extra, points2Extra, goals2Penalties, 
        umpireTeamPlanned, umpireTeamId, 
        outcome, 
        created, updated 
      FROM fixtures 
      WHERE tournamentId = ? AND category = ?
      ORDER BY stage, groupNumber, scheduledPlanned, id
    `,
      [tournamentId, category]
    );

    let lastUpdated: string | null = null;
    const groupFixtures: any[] = [];
    const knockoutFixtures: any[] = [];

    fixturesData.forEach((f: any) => {
      if (
        !lastUpdated ||
        (f.updated && new Date(f.updated) > new Date(lastUpdated))
      ) {
        lastUpdated = f.updated;
      }

      const hasResult = !['not played', 'skipped'].includes(
        String(f.outcome || '').toLowerCase()
      );
      f.total1 = hasResult
        ? calculateAggregateMatchScore({
            goals: f.goals1,
            points: f.points1,
            goalsExtra: f.goals1Extra,
            pointsExtra: f.points1Extra,
            goalsPenalties: f.goals1Penalties,
          })
        : null;
      f.total2 = hasResult
        ? calculateAggregateMatchScore({
            goals: f.goals2,
            points: f.points2,
            goalsExtra: f.goals2Extra,
            pointsExtra: f.points2Extra,
            goalsPenalties: f.goals2Penalties,
          })
        : null;

      const actualDuration =
        f.started && f.ended
          ? Math.round(
              (new Date(f.ended).getTime() - new Date(f.started).getTime()) /
                60000
            )
          : null;

      const transformedFixture = {
        matchId: f.id,
        matchLabel: generateMatchLabel(f.category, f.id),
        cards: cardsByFixtureId.get(f.id) || [],
        pool: f.stage === 'group' ? f.groupNumber : null,
        bracket: calcBracket(f.stage),
        stage: calcStage(f.stage, f.groupNumber),
        planned: {
          team1: f.team1Planned,
          team2: f.team2Planned,
          umpireTeam: f.umpireTeamPlanned,
          scheduled: f.scheduledPlanned,
          pitch: f.pitchPlanned,
          duration: f.durationPlanned,
        },
        actual: {
          scheduled: f.scheduled,
          pitch: f.pitch,
          started: f.started,
          ended: f.ended,
          duration: actualDuration,
        },
        team1: {
          name: friendlyTeamLabel(f.team1),
          goals: f.goals1,
          points: f.points1,
          total: f.total1,
          goalsExtra: f.goals1Extra,
          pointsExtra: f.points1Extra,
          goalsPenalties: f.goals1Penalties,
          status: getMatchStatus(f.outcome, f.total1, f.total2),
        },
        team2: {
          name: friendlyTeamLabel(f.team2),
          goals: f.goals2,
          points: f.points2,
          total: f.total2,
          goalsExtra: f.goals2Extra,
          pointsExtra: f.points2Extra,
          goalsPenalties: f.goals2Penalties,
          status: getMatchStatus(f.outcome, f.total2, f.total1),
        },
        umpireTeam: friendlyTeamLabel(f.umpireTeamId),
        outcome: f.outcome,
      };

      if (f.stage === 'group') {
        groupFixtures.push(transformedFixture);
      } else {
        knockoutFixtures.push(transformedFixture);
      }
    });

    return {
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      totals: {
        group: groupFixtures.length,
        knockouts: knockoutFixtures.length,
      },
      stage: {
        group: groupFixtures,
        knockouts: knockoutFixtures,
      },
    };
  }

  async getPitchInfo(tournamentId: number): Promise<any[]> {
    return await this.select(
      `
      SELECT DISTINCT pitch, MIN(id) as id, MIN(location) as location 
      FROM pitches 
      WHERE tournamentId=? 
      GROUP BY pitch
      ORDER BY pitch
    `,
      [tournamentId]
    );
  }

  async getTournamentInfo(
    tournamentId: number
  ): Promise<TournamentInfo | null> {
    const results = await this.select(
      `SELECT 
       Date as startDate, endDate, Title, Location,
       region, season, Lat, Lon, eventUuid, status,
       pointsForWin, pointsForDraw, pointsForLoss
       FROM tournaments where id=?`,
      [tournamentId]
    );

    if (!results || results.length === 0) {
      console.error(`Tournament with ID ${tournamentId} not found.`);
      return null;
    }
    const res = results[0];

    return {
      eventUuid: res.eventUuid,
      status: res.status,
      date: res.startDate,
      title: res.Title,
      season: res.season,
      location: {
        region: res.region,
        address: res.Location,
        lat: res.Lat,
        lon: res.Lon,
      },
      pointsFor: {
        win: res.pointsForWin,
        draw: res.pointsForDraw,
        loss: res.pointsForLoss,
      },
    };
  }
}

export default ReportBuilder;
