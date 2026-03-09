/**
 * Exporter for CSV format
 */

export interface Tournament {
  title: string;
  date: string;
  season: string;
  location: {
    address: string;
    region: string;
  };
  status: string;
  pointsFor: {
    win: number;
    draw: number;
    loss: number;
  };
}

export interface Fixture {
  stage: string;
  pool?: string;
  bracket?: string;
  matchId: string;
  team1: {
    name: string;
    goals: number | null;
    points: number | null;
  };
  team2: {
    name: string;
    goals: number | null;
    points: number | null;
  };
  actual: {
    scheduled?: string;
    pitch?: string;
  };
  planned: {
    scheduled: string;
    pitch: string;
  };
  outcome: string;
}

export interface Category {
  category: string;
  fixtures?: {
    stage: {
      group: Fixture[];
      knockouts: Fixture[];
    };
  };
  standings?: {
    byGroup?: { [groupName: string]: TeamStanding[] };
    allGroups?: TeamStanding[];
  };
}

export interface TeamStanding {
  team: string;
  matchesPlayed: number;
  won: number;
  draw: number;
  loss: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
}

export interface ReportData {
  tournament: Tournament;
  categories: Category[];
}

export class CsvExporter {
  export(reportData: ReportData): {
    tournamentInfo: (string | number)[][];
    fixtures: (string | number)[][];
    standings: (string | number)[][];
  } {
    const tournamentInfo = this.formatTournamentInfo(reportData.tournament);
    const fixtureRows = this.formatFixtures(reportData.categories);
    const standingsRows = this.formatStandings(reportData.categories);

    return {
      tournamentInfo,
      fixtures: fixtureRows,
      standings: standingsRows,
    };
  }

  formatTournamentInfo(tournament: Tournament | null): (string | number)[][] {
    if (!tournament) return [];

    return [
      ['Tournament Information'],
      ['Title', tournament.title],
      ['Date', tournament.date],
      ['Season', tournament.season],
      ['Location', tournament.location.address],
      ['Region', tournament.location.region],
      ['Status', tournament.status],
      ['Points for Win', tournament.pointsFor.win],
      ['Points for Draw', tournament.pointsFor.draw],
      ['Points for Loss', tournament.pointsFor.loss],
    ];
  }

  formatFixtures(categories: Category[]): (string | number)[][] {
    if (!categories || categories.length === 0) return [];

    const headers = [
      'Category',
      'Stage',
      'Pool/Bracket',
      'Match ID',
      'Team 1',
      'Team 1 Score',
      'Team 2',
      'Team 2 Score',
      'Scheduled Time',
      'Pitch',
      'Status',
    ];

    const rows: (string | number)[][] = [headers];

    categories.forEach((category) => {
      const catName = category.category;

      if (
        category.fixtures &&
        category.fixtures.stage &&
        category.fixtures.stage.group
      ) {
        category.fixtures.stage.group.forEach((fixture) => {
          rows.push(this.formatFixtureRow(catName, 'Group', fixture));
        });
      }

      if (
        category.fixtures &&
        category.fixtures.stage &&
        category.fixtures.stage.knockouts
      ) {
        category.fixtures.stage.knockouts.forEach((fixture) => {
          rows.push(this.formatFixtureRow(catName, 'Knockout', fixture));
        });
      }
    });

    return rows;
  }

  formatFixtureRow(
    category: string,
    stageType: string,
    fixture: Fixture
  ): (string | number)[] {
    const team1Score =
      fixture.team1.goals !== null
        ? `${fixture.team1.goals}-${fixture.team1.points}`
        : '';
    const team2Score =
      fixture.team2.goals !== null
        ? `${fixture.team2.goals}-${fixture.team2.points}`
        : '';

    return [
      category,
      fixture.stage || stageType,
      stageType === 'Group' ? fixture.pool : fixture.bracket,
      fixture.matchId,
      fixture.team1.name,
      team1Score,
      fixture.team2.name,
      team2Score,
      fixture.actual.scheduled || fixture.planned.scheduled,
      fixture.actual.pitch || fixture.planned.pitch,
      fixture.outcome,
    ];
  }

  formatStandings(categories: Category[]): (string | number)[][] {
    if (!categories || categories.length === 0) return [];

    const allStandingsRows: (string | number)[][] = [];

    categories.forEach((category) => {
      if (!category.standings) return;

      allStandingsRows.push([`Standings for ${category.category}`]);

      if (category.standings.byGroup) {
        const groupKeys = Object.keys(category.standings.byGroup);

        const sortedGroupKeys = groupKeys
          .filter((key) => key.startsWith('GP.'))
          .sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)));

        sortedGroupKeys.forEach((groupName) => {
          const standings = category.standings!.byGroup![groupName];
          if (!standings || standings.length === 0) return;

          allStandingsRows.push([]);
          const title = `Group: ${groupName}`;
          allStandingsRows.push([title]);

          const headers = [
            'Rank',
            'Team',
            'Played',
            'Won',
            'Draw',
            'Loss',
            'Score For',
            'Score Against',
            'Score Diff',
            'Points',
          ];
          allStandingsRows.push(headers);

          standings.forEach((team, index) => {
            const row = [
              index + 1,
              team.team,
              team.matchesPlayed,
              team.won,
              team.draw,
              team.loss,
              team.scoreFor,
              team.scoreAgainst,
              team.scoreDifference,
              team.points,
            ];
            allStandingsRows.push(row);
          });
        });
      }

      if (
        category.standings.allGroups &&
        category.standings.allGroups.length > 0
      ) {
        const standings = category.standings.allGroups;

        allStandingsRows.push([]);
        const title = 'Overall Group Standings';
        allStandingsRows.push([title]);

        const headers = [
          'Rank',
          'Team',
          'Played',
          'Won',
          'Draw',
          'Loss',
          'Score For',
          'Score Against',
          'Score Diff',
          'Points',
        ];
        allStandingsRows.push(headers);

        standings.forEach((team, index) => {
          const row = [
            index + 1,
            team.team,
            team.matchesPlayed,
            team.won,
            team.draw,
            team.loss,
            team.scoreFor,
            team.scoreAgainst,
            team.scoreDifference,
            team.points,
          ];
          allStandingsRows.push(row);
        });
      }
    });

    return allStandingsRows;
  }
}

export default CsvExporter;
