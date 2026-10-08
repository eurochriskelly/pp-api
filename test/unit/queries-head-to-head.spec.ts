import test from 'node:test';
import assert from 'node:assert/strict';

import { sqlGroupStandingsWithH2H } from '../../src/lib/queries';

test('head-to-head query excludes only in-progress and not-played matches', () => {
  const query = sqlGroupStandingsWithH2H(3);

  assert.match(query, /f\.outcome NOT IN \('in-progress', 'not played'\)/);
});

test('group standings award one point for a skipped win', () => {
  const query = sqlGroupStandingsWithH2H(3);

  assert.match(
    query,
    /CASE WHEN f\.outcome = 'skipped' THEN 1 ELSE COALESCE\(cs\.winPoints, t\.pointsForWin, 3\) END/
  );
});

test('head-to-head query only joins matches from the same tournament', () => {
  const query = sqlGroupStandingsWithH2H(3);

  assert.match(query, /f\.tournamentId,/);
  assert.match(query, /bs\.tournamentId = hhm\.tournamentId/);
});
