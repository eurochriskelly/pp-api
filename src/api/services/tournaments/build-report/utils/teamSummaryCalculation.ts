import { calculateTeamRankings } from './teamRankingCalculation';

export interface TeamSummaryInput {
  allTeams: string[];
  fixtures: {
    stage: {
      group: Array<{
        outcome: string;
        team1: { name: string; goals: number; points: number };
        team2: { name: string; goals: number; points: number };
        planned: { duration: number };
        cards: Array<{ team: string; cardColor: 'yellow' | 'red' | 'black' }>;
      }>;
      knockouts: Array<{
        outcome: string;
        team1: { name: string; goals: number; points: number };
        team2: { name: string; goals: number; points: number };
        planned: { duration: number };
        cards: Array<{ team: string; cardColor: 'yellow' | 'red' | 'black' }>;
      }>;
    };
  };
  teamsByGroup: Array<{ group: number; teams: string[] }>;
  teamsByBracket: Array<{ bracket: string; teams: string[] }>;
  standings: {
    allGroups: Array<{ team: string }>;
  };
}

export interface TeamSummary {
  team: string;
  rank: number | null;
  playingTime: number;
  matchesPlayed: number;
  matchesSkipped: number;
  progression: {
    group: number | null;
    bracket: string | null;
  };
  totalScore: {
    for: { goals: number; points: number; score: number };
    against: { goals: number; points: number; score: number };
    scoreDifference: number;
    scoreGainRatePerMinute: number;
    scoreLossRatePerMinute: number;
    scoreNetRatePerMinute: number;
  };
  cards: { yellow: number; red: number; black: number };
}

/**
 * Calculates a detailed summary for each team in a category.
 */
export function calculateTeamSummary(
  allTeams: string[],
  fixtures: TeamSummaryInput['fixtures'],
  teamsByGroup: TeamSummaryInput['teamsByGroup'],
  teamsByBracket: TeamSummaryInput['teamsByBracket'],
  standings: TeamSummaryInput['standings']
): TeamSummary[] {
  const summaryMap = new Map<string, TeamSummary>();
  const teamRanks = calculateTeamRankings(
    fixtures as any,
    teamsByBracket,
    standings.allGroups
  );

  allTeams.forEach((team) => {
    summaryMap.set(team, {
      team: team,
      rank: teamRanks.get(team) || null,
      playingTime: 0,
      matchesPlayed: 0,
      matchesSkipped: 0,
      progression: {
        group: null,
        bracket: null,
      },
      totalScore: {
        for: { goals: 0, points: 0, score: 0 },
        against: { goals: 0, points: 0, score: 0 },
        scoreDifference: 0,
        scoreGainRatePerMinute: 0,
        scoreLossRatePerMinute: 0,
        scoreNetRatePerMinute: 0,
      },
      cards: { yellow: 0, red: 0, black: 0 },
    });
  });

  teamsByGroup.forEach((groupInfo) => {
    groupInfo.teams.forEach((teamName) => {
      if (summaryMap.has(teamName)) {
        summaryMap.get(teamName)!.progression.group = groupInfo.group;
      }
    });
  });

  teamsByBracket.forEach((bracketInfo) => {
    bracketInfo.teams.forEach((teamName) => {
      if (summaryMap.has(teamName)) {
        summaryMap.get(teamName)!.progression.bracket = bracketInfo.bracket;
      }
    });
  });

  const allFixtures = [...fixtures.stage.group, ...fixtures.stage.knockouts];

  allFixtures.forEach((fixture) => {
    if (
      fixture.outcome === 'not played' ||
      !fixture.team1.name ||
      !fixture.team2.name
    ) {
      return;
    }

    const team1Name = fixture.team1.name;
    const team2Name = fixture.team2.name;
    const team1Summary = summaryMap.get(team1Name);
    const team2Summary = summaryMap.get(team2Name);

    if (!team1Summary || !team2Summary) {
      return;
    }

    if (fixture.outcome === 'skipped') {
      team1Summary.matchesSkipped++;
      team2Summary.matchesSkipped++;
      return;
    }

    team1Summary.matchesPlayed++;
    team2Summary.matchesPlayed++;

    const duration = fixture.planned.duration || 0;
    team1Summary.playingTime += duration;
    team2Summary.playingTime += duration;

    team1Summary.totalScore.for.goals += fixture.team1.goals;
    team1Summary.totalScore.for.points += fixture.team1.points;
    team1Summary.totalScore.against.goals += fixture.team2.goals;
    team1Summary.totalScore.against.points += fixture.team2.points;

    team2Summary.totalScore.for.goals += fixture.team2.goals;
    team2Summary.totalScore.for.points += fixture.team2.points;
    team2Summary.totalScore.against.goals += fixture.team1.goals;
    team2Summary.totalScore.against.points += fixture.team1.points;

    fixture.cards.forEach((card) => {
      if (
        card.team === team1Name &&
        team1Summary.cards[card.cardColor] !== undefined
      ) {
        team1Summary.cards[card.cardColor]++;
      } else if (
        card.team === team2Name &&
        team2Summary.cards[card.cardColor] !== undefined
      ) {
        team2Summary.cards[card.cardColor]++;
      }
    });
  });

  const summaryArray: TeamSummary[] = [];
  summaryMap.forEach((summary) => {
    const scoreFor =
      summary.totalScore.for.goals * 3 + summary.totalScore.for.points;
    const scoreAgainst =
      summary.totalScore.against.goals * 3 + summary.totalScore.against.points;
    const scoreDifference = scoreFor - scoreAgainst;

    summary.totalScore.for.score = scoreFor;
    summary.totalScore.against.score = scoreAgainst;
    summary.totalScore.scoreDifference = scoreDifference;

    if (summary.playingTime > 0) {
      summary.totalScore.scoreGainRatePerMinute =
        scoreFor / summary.playingTime;
      summary.totalScore.scoreLossRatePerMinute =
        scoreAgainst / summary.playingTime;
      summary.totalScore.scoreNetRatePerMinute =
        scoreDifference / summary.playingTime;
    }

    summaryArray.push(summary);
  });

  summaryArray.sort((a, b) => a.team.localeCompare(b.team));

  return summaryArray;
}

export default calculateTeamSummary;
