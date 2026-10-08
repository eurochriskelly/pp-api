#!/usr/bin/env node

const tournamentId = process.argv[2] || '68';
const category = process.argv[3] || 'HURLING';
const reportUrl = `https://live.pitchperfect.eu.com/api/tournaments/${tournamentId}/report`;

function resolveGroupReference(reference, standings) {
  const match = reference.match(/^~group:(\d+)\/p:(\d+)$/);
  if (!match) return null;

  const group = `GP.${match[1]}`;
  const position = Number(match[2]);
  const row = standings.byGroup?.[group]?.[position - 1];
  return row ? row.team : `[pending: ${group} position ${position}]`;
}

function resolveReference(reference, report, standings) {
  if (!reference) return '[unassigned]';

  const groupTeam = resolveGroupReference(reference, standings);
  if (groupTeam) return groupTeam;

  const match = reference.match(/^~match:(\d+)\/p:([12])$/);
  if (match) {
    const fixtureId = Number(match[1]);
    const fixture = report.fixtures.stage.knockouts.find(
      (candidate) => candidate.matchId === fixtureId
    );
    if (!fixture) return `[unknown match ${fixtureId}]`;

    const team = Number(match[2]) === 1 ? fixture.team1 : fixture.team2;
    if (fixture.outcome === 'played' && team?.name) return team.name;
    return `${Number(match[2]) === 1 ? 'Winner' : 'Loser'} of ${fixture.matchLabel}`;
  }

  return reference;
}

function printStandings(standings) {
  console.log('Current group positions:');
  for (const [group, rows] of Object.entries(standings.byGroup || {})) {
    console.log(
      `  ${group}: ${rows
        .map(
          (row, index) =>
            `${index + 1}. ${row.team}${row.jointPosition ? ' (joint)' : ''}`
        )
        .join(' | ')}`
    );
  }
}

async function main() {
  const response = await fetch(reportUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${reportUrl}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const report = payload.data;
  const categoryReport = report.categories.find(
    (candidate) => candidate.category.toUpperCase() === category.toUpperCase()
  );
  if (!categoryReport) {
    throw new Error(
      `Category ${category} was not found in tournament ${tournamentId}`
    );
  }

  console.log(`Tournament ${tournamentId}: ${categoryReport.category}`);
  console.log(`Report updated: ${report.lastUpdate}`);
  printStandings(categoryReport.standings);
  console.log('\nExpected playoff matchups from current positions:');

  for (const fixture of categoryReport.fixtures.stage.knockouts) {
    const expectedTeam1 = resolveReference(
      fixture.planned.team1,
      categoryReport,
      categoryReport.standings
    );
    const expectedTeam2 = resolveReference(
      fixture.planned.team2,
      categoryReport,
      categoryReport.standings
    );
    const actual = `${fixture.team1.name || '[unassigned]'} vs ${fixture.team2.name || '[unassigned]'}`;

    console.log(
      `  ${fixture.matchLabel} [${fixture.bracket} ${fixture.stage}]: ${expectedTeam1} vs ${expectedTeam2}`
    );
    if (actual !== `${expectedTeam1} vs ${expectedTeam2}`) {
      console.log(`    database assignment: ${actual}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
