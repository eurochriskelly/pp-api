import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFinalRankings } from '../../src/api/services/tournaments/build-report/utils/finalRankingsCalculation';

const unresolvedTeamPattern =
  /^(?:\d+(?:st|nd|rd|th) in GP\.\d+|Winner of \d+|Loser of \d+)$/;

function standingsFor(teams: string[]) {
  return teams.map((team) => ({
    team,
    points: 0,
    scoreDifference: 0,
    scoreFor: 0,
  }));
}

function unplayedFixture(stage: string, team1: string, team2: string) {
  return {
    bracket: 'Cup',
    stage,
    outcome: 'not played',
    team1: { name: team1, status: 'draw' },
    team2: { name: team2, status: 'draw' },
  };
}

function playedFixture(
  stage: string,
  team1: string,
  team2: string,
  team1Status: 'won' | 'lost',
  team2Status: 'won' | 'lost'
) {
  return {
    bracket: 'Cup',
    stage,
    outcome: 'played',
    team1: { name: team1, status: team1Status },
    team2: { name: team2, status: team2Status },
  };
}

function assertOnlyRealTeams(rankings: Array<{ teamName: string }>) {
  assert.ok(
    rankings.every((ranking) => !unresolvedTeamPattern.test(ranking.teamName)),
    'rankings should not include unresolved knockout placeholders'
  );
}

function assertNoCategoryOverflow(
  rankings: unknown[],
  categoryTeams: string[]
) {
  assert.ok(
    rankings.length <= categoryTeams.length,
    `rankings length ${rankings.length} exceeds team count ${categoryTeams.length}`
  );
}

test('calculateFinalRankings excludes unresolved knockout placeholders before tournament starts', () => {
  const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const rankings = calculateFinalRankings(
    {
      stage: {
        knockouts: [
          unplayedFixture('FIN', '1st in GP.1', '2nd in GP.1'),
          unplayedFixture('3/4', '3rd in GP.1', '4th in GP.1'),
          unplayedFixture('5/6', 'Winner of 16', 'Loser of 16'),
        ],
      },
    },
    [
      { bracket: 'Cup', teams: [] },
      { bracket: 'None', teams },
    ],
    [{ group: 1, teams }],
    standingsFor(teams)
  );

  assertNoCategoryOverflow(rankings, teams);
  assertOnlyRealTeams(rankings);
  assert.deepEqual(
    new Set(rankings.map((ranking) => ranking.teamName)),
    new Set(teams)
  );
});

test('calculateFinalRankings does not emit unresolved group-position placeholders for incomplete tied groups', () => {
  const teams = ['Ajax', 'Brest', 'Cardiff', 'Derry'];
  const tiedStandings = standingsFor(teams).map((standing) => ({
    ...standing,
    position: 1,
    jointPosition: true,
  }));

  const rankings = calculateFinalRankings(
    {
      stage: {
        knockouts: [
          unplayedFixture('FIN', '1st in GP.1', '2nd in GP.1'),
          unplayedFixture('3/4', '3rd in GP.1', '4th in GP.1'),
        ],
      },
    },
    [
      { bracket: 'Cup', teams: [] },
      { bracket: 'None', teams },
    ],
    [{ group: 1, teams }],
    tiedStandings
  );

  assertNoCategoryOverflow(rankings, teams);
  assertOnlyRealTeams(rankings);
});

test('calculateFinalRankings returns one real row per team after completed knockouts', () => {
  const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const rankings = calculateFinalRankings(
    {
      stage: {
        knockouts: [
          playedFixture('FIN', 'Alpha', 'Bravo', 'won', 'lost'),
          playedFixture('3/4', 'Charlie', 'Delta', 'won', 'lost'),
          playedFixture('5/6', 'Echo', 'Foxtrot', 'lost', 'won'),
        ],
      },
    },
    [{ bracket: 'Cup', teams }],
    [{ group: 1, teams }],
    standingsFor(teams)
  );

  assert.equal(rankings.length, teams.length);
  assertOnlyRealTeams(rankings);
  assert.deepEqual(
    rankings.map((ranking) => [ranking.position, ranking.teamName]),
    [
      [1, 'Alpha'],
      [2, 'Bravo'],
      [3, 'Charlie'],
      [4, 'Delta'],
      [5, 'Foxtrot'],
      [6, 'Echo'],
    ]
  );
  assert.equal(new Set(rankings.map((ranking) => ranking.teamName)).size, 6);
  assert.equal(new Set(rankings.map((ranking) => ranking.position)).size, 6);
});

test('calculateFinalRankings category output never exceeds allTeams length', () => {
  const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const rankings = calculateFinalRankings(
    {
      stage: {
        knockouts: [
          unplayedFixture('FIN', '1st in GP.1', '2nd in GP.1'),
          unplayedFixture('3/4', '3rd in GP.1', '4th in GP.1'),
          unplayedFixture('5/6', '5th in GP.1', '6th in GP.1'),
        ],
      },
    },
    [
      { bracket: 'Cup', teams: [] },
      { bracket: 'None', teams },
    ],
    [{ group: 1, teams }],
    standingsFor(teams)
  );

  const category = {
    teams: { allTeams: teams },
    rankings,
  };

  assertNoCategoryOverflow(category.rankings, category.teams.allTeams);
});
