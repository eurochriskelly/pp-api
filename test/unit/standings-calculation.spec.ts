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
  assert.equal(overallByTeam.get('B1')?.originalGroupSize, 4);

  assert.equal(overallByTeam.get('C1')?.matchesPlayed, 2);
  assert.equal(overallByTeam.get('C1')?.points, 4);
  assert.equal(overallByTeam.get('C1')?.originalGroupSize, 4);
  assert.equal(overallByTeam.get('B4')?.matchesPlayed, 3);
  assert.equal(overallByTeam.get('B4')?.points, 0);
  assert.equal(overallByTeam.get('A1')?.originalGroupSize, 3);
  assert.ok(
    standings.allGroups
      .slice(0, 9)
      .every((team) => team.matchesPlayed === 2)
  );
});

test('calculateStandings uses original group points as a tiebreaker in overall standings', () => {
  const standings = calculateStandings(
    {
      stage: {
        group: [
          createFixture({
            pool: 1,
            team1: 'A1',
            team2: 'A2',
            score1: 4,
            score2: 2,
          }),
          createFixture({
            pool: 1,
            team1: 'A1',
            team2: 'A3',
            score1: 5,
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
            score1: 4,
            score2: 1,
          }),
          createFixture({
            pool: 2,
            team1: 'B1',
            team2: 'B4',
            score1: 1,
            score2: 5,
          }),
          createFixture({
            pool: 2,
            team1: 'B2',
            team2: 'B3',
            score1: 2,
            score2: 3,
          }),
          createFixture({
            pool: 2,
            team1: 'B2',
            team2: 'B4',
            score1: 5,
            score2: 1,
          }),
          createFixture({
            pool: 2,
            team1: 'B3',
            team2: 'B4',
            score1: 2,
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
            score1: 2,
            score2: 4,
          }),
          createFixture({
            pool: 3,
            team1: 'C2',
            team2: 'C4',
            score1: 2,
            score2: 1,
          }),
          createFixture({
            pool: 3,
            team1: 'C3',
            team2: 'C4',
            score1: 2,
            score2: 0,
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

  const teamOrder = standings.allGroups.map((team) => team.team);
  const c1 = standings.allGroups.find((team) => team.team === 'C1');
  const a1 = standings.allGroups.find((team) => team.team === 'A1');

  assert.ok(c1);
  assert.ok(a1);
  assert.equal(c1?.points, 4);
  assert.equal(a1?.points, 4);
  assert.equal(c1?.originalGroupPoints, 6);
  assert.equal(a1?.originalGroupPoints, 4);
  assert.ok((c1?.scoreDifference || 0) < (a1?.scoreDifference || 0));
  assert.ok(teamOrder.indexOf('A1') < teamOrder.indexOf('C1'));

  const b1 = standings.allGroups.find((team) => team.team === 'B1');

  assert.ok(b1);
  assert.equal(b1?.points, 4);
  assert.equal(b1?.originalGroupPoints, 4);
  assert.equal(b1?.originalGroupSize, 4);
  assert.equal(c1?.originalGroupSize, 4);
  assert.ok((c1?.scoreDifference || 0) < (b1?.scoreDifference || 0));
  assert.ok(teamOrder.indexOf('C1') < teamOrder.indexOf('B1'));
});
