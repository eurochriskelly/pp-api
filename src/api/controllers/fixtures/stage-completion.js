module.exports = {
  processStageCompletion,
}

async function processStageCompletion(fixtureId) {
  DD(`Processing stage completion for fixture [${fixtureId}]`);
  const [fixture] = await select(
    `SELECT tournamentId, stage, groupNumber, category FROM fixtures WHERE id = ?`,
    [fixtureId]
  );
  if (!fixture) return false;

  const [remaining] = await select(
    `SELECT count(*) as remaining FROM fixtures 
     WHERE tournamentId = ? AND stage = ? AND groupNumber = ? AND category = ? AND goals1 is null`,
    [fixture.tournamentId, fixture.stage, fixture.groupNumber, fixture.category]
  );

  if (remaining.remaining === 0) {
    DD(`Stage [${fixture.stage}] completed - updating calculated teams`);
    const groupStandings = await select(
      `SELECT * FROM ${sqlGroupStandings(winAward)} 
       WHERE tournamentId = ? AND grp = ? AND category = ?`,
      [fixture.tournamentId, fixture.groupNumber, fixture.category]
    );

    const numPositions = fixture.stage === "group" 
      ? (await select(
          `SELECT count(*) as numPositions FROM v_fixture_information 
           WHERE tournamentId = ? AND stage = ? AND groupNumber = ? AND category = ?`,
          [fixture.tournamentId, fixture.stage, fixture.groupNumber, fixture.category]
        ))[0].numPositions || 0
      : 2;

    let totalUpdated = 0;
    for (let position = 0; position < numPositions; position++) {
      const placeHolder = `~${fixture.stage}:${fixture.groupNumber}/p:${position + 1}`;
      const newValue = groupStandings[position]?.team;
      
      const updateTeam = async (teamField) => {
        const result = await update(
          `UPDATE fixtures SET ${teamField}Id = ? 
           WHERE ${teamField}Planned = ? AND tournamentId = ? AND category = ?`,
          [newValue, placeHolder, fixture.tournamentId, fixture.category]
        );
        return result.affectedRows;
      };

      totalUpdated += 
        await updateTeam("team1") + 
        await updateTeam("team2") + 
        await updateTeam("umpireTeam");
    }

    DD(`Updated ${totalUpdated} fixtures for completed stage`);
    return true;
  }
  DD(`Stage has ${remaining.remaining} remaining matches`);
  return false;
}
