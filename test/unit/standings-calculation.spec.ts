import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateStandings } from '../../src/api/services/tournaments/build-report/utils/standingsCalculation';

function createFixture({
  pool,
  team1,
  team2,
  score1,
  score2,
}: {
  pool: number;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
}) {
  let team1Status: 'won' | 'lost' | 'draw' = 'draw';
  let team2Status: 'won' | 'lost' | 'draw' = 'draw';

  if (score1 > score2) {
    team1Status = 'won';
    team2Status = 'lost';
  } else if (score2 > score1) {
    team1Status = 'lost';
    team2Status = 'won';
  }

  return {
    outcome: 'played',
    pool,
    team1: {
      name: team1,
      total: score1,
      status: team1Status,
      goals: Math.floor(score1 / 3),
      points: score1 % 3,
    },
    team2: {
      name: team2,
      total: score2,
      status: team2Status,
      goals: Math.floor(score2 / 3),
      points: score2 % 3,
    },
  };
}

test('calculateStandings normalizes overall standings to the smallest group size', () => {
  const standings = calculateStandings(
    {
      stage: {
        group: [
          createFixture({
            pool: 1,
            team1: 'A1',
            team2: 'A2',
            score1: 5,
            score2: 2,
          }),
          createFixture({
            pool: 1,
            team1: 'A1',
            team2: 'A3',
            score1: 4,
            score2: 1,
          }),
          createFixture({
            pool: 1,
            team1: 'A2',
            team2: 'A3',
            score1: 3,
            score2: 2,
          }),
          createFixture({
            pool: 2,
            team1: 'B1',
            team2: 'B2',
            score1: 4,
            score2: 2,
          }),
          createFixture({
            pool: 2,
            team1: 'B1',
            team2: 'B3',
            score1: 3,
            score2: 2,
          }),
          createFixture({
            pool: 2,
            team1: 'B1',
            team2: 'B4',
            score1: 6,
            score2: 0,
          }),
          createFixture({
            pool: 2,
            team1: 'B2',
            team2: 'B3',
            score1: 5,
            score2: 3,
          }),
          createFixture({
            pool: 2,
            team1: 'B2',
            team2: 'B4',
            score1: 2,
            score2: 1,
          }),
          createFixture({
            pool: 2,
            team1: 'B3',
            team2: 'B4',
            score1: 4,
            score2: 1,
          }),
          createFixture({
            pool: 3,
            team1: 'C1',
            team2: 'C2',
            score1: 3,
            score2: 1,
          }),
          createFixture({
            pool: 3,
            team1: 'C1',
            team2: 'C3',
            score1: 4,
            score2: 2,
          }),
          createFixture({
            pool: 3,
            team1: 'C1',
            team2: 'C4',
            score1: 5,
            score2: 0,
          }),
          createFixture({
            pool: 3,
            team1: 'C2',
            team2: 'C3',
            score1: 4,
            score2: 3,
          }),
          createFixture({
            pool: 3,
            team1: 'C2',
            team2: 'C4',
            score1: 3,
            score2: 1,
          }),
          createFixture({
            pool: 3,
            team1: 'C3',
            team2: 'C4',
            score1: 2,
            score2: 1,
          }),
        ],
      },
    } as any,
    [
      { group: 1, teams: ['A1', 'A2', 'A3'] },
      { group: 2, teams: ['B1', 'B2', 'B3', 'B4'] },
      { group: 3, teams: ['C1', 'C2', 'C3', 'C4'] },
    ],
    { win: 2, draw: 1, loss: 0 }
  );

  const overallByTeam = new Map(
    standings.allGroups.map((team) => [team.team, team] as const)
  );

  assert.equal(overallByTeam.get('B1')?.matchesPlayed, 2);
  assert.equal(overallByTeam.get('B1')?.won, 2);
  assert.equal(overallByTeam.get('B1')?.points, 4);
  assert.equal(overallByTeam.get('B1')?.scoreDifference, 3);

  assert.equal(overallByTeam.get('C1')?.matchesPlayed, 2);
  assert.equal(overallByTeam.get('C1')?.points, 4);
  assert.equal(overallByTeam.get('B4')?.matchesPlayed, 3);
  assert.equal(overallByTeam.get('B4')?.points, 0);

  assert.deepEqual(
    standings.allGroups.slice(0, 9).map((team) => ({
      team: team.team,
      matchesPlayed: team.matchesPlayed,
      points: team.points,
    })),
    [
      { team: 'A1', matchesPlayed: 2, points: 4 },
      { team: 'C1', matchesPlayed: 2, points: 4 },
      { team: 'B1', matchesPlayed: 2, points: 4 },
      { team: 'B2', matchesPlayed: 2, points: 2 },
      { team: 'C2', matchesPlayed: 2, points: 2 },
      { team: 'A2', matchesPlayed: 2, points: 2 },
      { team: 'B3', matchesPlayed: 2, points: 0 },
      { team: 'C3', matchesPlayed: 2, points: 0 },
      { team: 'A3', matchesPlayed: 2, points: 0 },
    ]
  );
});
