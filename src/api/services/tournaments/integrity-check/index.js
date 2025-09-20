const { DD } = require('../../../../lib/logging');

function parseMatchReference(teamId) {
  if (!teamId || !teamId.startsWith('~match:')) {
    return null;
  }
  const match = teamId.match(/^~match:(\d+)\/p:([12])$/);
  if (!match) {
    return null;
  }
  return {
    matchId: parseInt(match[1], 10),
    position: parseInt(match[2], 10),
  };
}

async function checkIntegrity(tournamentId, select) {
  DD(`Checking integrity for tournament ${tournamentId}`);

  // Get all fixtures for the tournament
  const fixtures = await select(
    'SELECT id, team1Id, team2Id, umpireTeamId, team1Planned, team2Planned, umpireTeamPlanned FROM fixtures WHERE tournamentId = ?',
    [tournamentId]
  );

  const warnings = [];
  let warningId = 1;

  for (const fixture of fixtures) {
    const fields = [
      {
        name: 'team1Planned',
        value: fixture.team1Planned,
        teamName: fixture.team1Id,
      },
      {
        name: 'team2Planned',
        value: fixture.team2Planned,
        teamName: fixture.team2Id,
      },
      {
        name: 'umpireTeamPlanned',
        value: fixture.umpireTeamPlanned,
        teamName: fixture.umpireTeamId,
      },
    ];

    for (const field of fields) {
      if (!field.value) continue;

      const ref = parseMatchReference(field.value);
      if (!ref) continue;

      DD(
        `Fixture ${fixture.id} has ${field.name} with match reference: ${field.value}`
      );

      // Query the referenced match
      const referencedFixtures = await select(
        'SELECT id, team1Planned, team2Planned, goals1, points1, goals2, points2 FROM fixtures WHERE id = ? AND tournamentId = ?',
        [ref.matchId, tournamentId]
      );

      if (referencedFixtures.length === 0) {
        DD(
          `Warning: Referenced match ${ref.matchId} not found for fixture ${fixture.id} field ${field.name}`
        );
        warnings.push({
          warningId: warningId++,
          message: `Referenced match ${ref.matchId} not found for fixture ${fixture.id} field ${field.name}`,
        });
        continue;
      }

      const refFixture = referencedFixtures[0];
      const score1 = (refFixture.goals1 || 0) * 3 + (refFixture.points1 || 0);
      const score2 = (refFixture.goals2 || 0) * 3 + (refFixture.points2 || 0);

      let winner;
      if (score1 > score2) {
        winner = 1;
      } else if (score2 > score1) {
        winner = 2;
      } else {
        winner = null; // It's a draw
      }

      if (!winner) {
        DD(
          `Warning: Match ${ref.matchId} is a draw or has no score, cannot determine winner/loser for fixture ${fixture.id}`
        );
        warnings.push({
          warningId: warningId++,
          message: `Referenced match ${ref.matchId} for fixture ${fixture.id} is a draw or has no score, so winner/loser cannot be determined.`,
        });
        continue;
      }

      const winnerTeam =
        winner === 1 ? refFixture.team1Planned : refFixture.team2Planned;
      const loserTeam =
        winner === 1 ? refFixture.team2Planned : refFixture.team1Planned;
      const expectedTeam = ref.position === 1 ? winnerTeam : loserTeam;

      if (field.teamName !== expectedTeam) {
        DD(
          `Warning: Fixture ${fixture.id} ${field.name} mismatch: expected '${expectedTeam}', got '${field.teamName}'`
        );
        warnings.push({
          warningId: warningId++,
          message: `Fixture ${fixture.id} has a ${field.name} value of '${field.value}' and a value of '${field.teamName}' but the ${ref.position === 1 ? 'winner' : 'loser'} (p${ref.position}) of match ${ref.matchId} was '${expectedTeam}'`,
        });
      }
    }
  }

  return { data: warnings };
}

module.exports = { checkIntegrity };
