import test from 'node:test';
import assert from 'node:assert/strict';

import { ReportBuilder } from '../../src/api/services/tournaments/build-report/ReportBuilder';

test('ReportBuilder aggregates extra-time scores into fixture totals and status', async () => {
  const builder = new ReportBuilder(async () => [
    {
      id: 101,
      tournamentId: 1,
      category: 'MEN',
      groupNumber: null,
      stage: 'cup_finals',
      pitchPlanned: 'Pitch 1',
      pitch: 'Pitch 1',
      scheduledPlanned: '2026-04-19T10:00:00.000Z',
      scheduled: '2026-04-19T10:00:00.000Z',
      started: null,
      ended: null,
      durationPlanned: 20,
      team1Planned: 'Alpha',
      team1: 'Alpha',
      team2Planned: 'Beta',
      team2: 'Beta',
      goals1: 1,
      points1: 0,
      goals1Extra: 0,
      points1Extra: 1,
      goals1Penalties: null,
      goals2: 1,
      points2: 0,
      goals2Extra: 0,
      points2Extra: 0,
      goals2Penalties: null,
      umpireTeamPlanned: null,
      umpireTeamId: null,
      outcome: 'played',
      created: '2026-04-19T09:00:00.000Z',
      updated: '2026-04-19T09:30:00.000Z',
    },
  ]);

  const fixtures = await builder.getFixturesForCategory(1, 'MEN', new Map());
  const [fixture] = fixtures.stage.knockouts;

  assert.equal(fixture.team1.total, 4);
  assert.equal(fixture.team2.total, 3);
  assert.equal(fixture.team1.status, 'won');
  assert.equal(fixture.team2.status, 'lost');
});

test('ReportBuilder aggregates penalty goals into fixture totals and status', async () => {
  const builder = new ReportBuilder(async () => [
    {
      id: 102,
      tournamentId: 1,
      category: 'MEN',
      groupNumber: null,
      stage: 'cup_finals',
      pitchPlanned: 'Pitch 2',
      pitch: 'Pitch 2',
      scheduledPlanned: '2026-04-19T11:00:00.000Z',
      scheduled: '2026-04-19T11:00:00.000Z',
      started: null,
      ended: null,
      durationPlanned: 20,
      team1Planned: 'Gamma',
      team1: 'Gamma',
      team2Planned: 'Delta',
      team2: 'Delta',
      goals1: 1,
      points1: 0,
      goals1Extra: 0,
      points1Extra: 0,
      goals1Penalties: 2,
      goals2: 1,
      points2: 0,
      goals2Extra: 0,
      points2Extra: 0,
      goals2Penalties: 3,
      umpireTeamPlanned: null,
      umpireTeamId: null,
      outcome: 'played',
      created: '2026-04-19T10:00:00.000Z',
      updated: '2026-04-19T10:30:00.000Z',
    },
  ]);

  const fixtures = await builder.getFixturesForCategory(1, 'MEN', new Map());
  const [fixture] = fixtures.stage.knockouts;

  assert.equal(fixture.team1.total, 5);
  assert.equal(fixture.team2.total, 6);
  assert.equal(fixture.team1.status, 'lost');
  assert.equal(fixture.team2.status, 'won');
});
