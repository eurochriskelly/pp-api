import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalculatedResolver } from '../../src/api/services/fixtures/calculated-fixtures/resolver';

test('early predictions remain valid across possible final outcomes and extreme margins', () => {
  const outcomes = [
    [0, 0],
    [1, 0],
    [0, 1],
    [100, 0],
    [0, 100],
  ];
  const pairs = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'C'],
  ];
  for (const completed of [1, 2]) {
    for (const first of outcomes) {
      for (const second of outcomes) {
        const fixtures = pairs.map(([team1Id, team2Id], index) => ({
          id: index + 1,
          stage: 'group',
          groupNumber: 1,
          team1Id,
          team2Id,
          goals1: 0,
          goals2: 0,
          points1: index === 0 ? first[0] : second[0],
          points2: index === 0 ? first[1] : second[1],
          outcome: index < completed ? 'played' : 'not played',
        }));
        const points = { win: 2, draw: 1, loss: 0 };
        const early = createCalculatedResolver(fixtures, points);
        for (const x of outcomes) {
          for (const y of outcomes) {
            const finalFixtures = fixtures.map((fixture, index) =>
              index < completed
                ? fixture
                : {
                    ...fixture,
                    outcome: 'played',
                    points1: (index === 1 ? x : y)[0],
                    points2: (index === 1 ? x : y)[1],
                  }
            );
            const final = createCalculatedResolver(finalFixtures, points);
            for (const position of [1, 2, 3]) {
              const reference = `~group:1/p:${position}`;
              const predicted = early(reference);
              if (predicted !== 'PENDING')
                assert.equal(
                  final(reference),
                  predicted,
                  `invalid prediction at ${reference}: ${JSON.stringify(fixtures)}`
                );
            }
          }
        }
      }
    }
  }
});
