// Note: Dependencies are injected by the factory function pattern
// Required dependencies: dbHelpers (select, update), loggers (II, DD), sqlGroupStandings

module.exports = ({ dbHelpers, loggers, sqlGroupStandings }) => {
  const { select, update } = dbHelpers;
  const { II, DD } = loggers;
  // Define constants or get from config if necessary
  const winAward = 3;

  // --- Main Entry Point ---

  async function processStageCompletion(fixtureId) {
    II(`Processing stage completion check for fixture [${fixtureId}]...`);

    const fixture = await _getFixtureDetails(fixtureId);
    if (!fixture) {
      II(`Fixture [${fixtureId}] not found. Aborting stage completion check.`);
      return false; // Fixture doesn't exist
    }
    // Destructure fixture properties for easier access
    const { tournamentId, stage, groupNumber, category } = fixture;

    const remainingCount = await _getRemainingFixtureCount(fixture); // Pass the whole fixture object

    if (remainingCount === 0) {
      II(`Stage [${stage}/${groupNumber}/${category}] for tournament [${tournamentId}] is complete.`);

      const standings = await _getGroupStandings(fixture); // Pass the whole fixture object
      if (!standings || standings.length === 0) {
          II(`No standings found for completed stage [${stage}/${groupNumber}/${category}]. Cannot update dependent fixtures.`);
          return false; // Should not happen if stage is complete, but safeguard
      }

      const numPositions = await _getNumPositionsToUpdate(fixture); // Pass the whole fixture object
      if (numPositions === 0) {
          II(`Determined 0 positions to update for stage [${stage}/${groupNumber}/${category}]. No dependent fixtures will be updated.`);
          return false; // Nothing to update based on stage type/config
      }

      II(`Updating ${numPositions} position(s) in dependent fixtures based on stage [${stage}/${groupNumber}/${category}] standings...`);
      const totalUpdated = await _updateDependentFixtures(fixture, standings, numPositions); // Pass the whole fixture object

      II(`Finished updating dependent fixtures for stage [${stage}/${groupNumber}/${category}]. Total rows affected: ${totalUpdated}.`);
      return totalUpdated > 0; // Return true if any updates actually happened
    } else {
      II(`Stage [${stage}/${groupNumber}/${category}] has ${remainingCount} remaining match(es). No updates needed yet.`);
      return false; // Stage not yet complete
    }
  }

  // --- Helper Functions ---

  async function _getFixtureDetails(fixtureId) {
    DD(`Fetching details for fixture [${fixtureId}]`);
    const [fixture] = await select(
      `SELECT id, tournamentId, stage, groupNumber, category FROM fixtures WHERE id = ?`,
      [fixtureId]
    );
    if (fixture) {
      DD(`Fixture details found: ${JSON.stringify(fixture)}`);
    } else {
      DD(`Fixture [${fixtureId}] not found.`);
    }
    return fixture; // Returns the fixture object or undefined
  }

  async function _getRemainingFixtureCount(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    DD(`Checking remaining fixtures for stage [${stage}], group [${groupNumber}], category [${category}] in tournament [${tournamentId}]`);
    const [result] = await select(
      `SELECT count(*) as remaining FROM fixtures
       WHERE tournamentId = ? AND stage = ? AND groupNumber = ? AND category = ? AND goals1 IS NULL`,
      [tournamentId, stage, groupNumber, category]
    );
    const remaining = result?.remaining ?? 0; // Default to 0 if result is undefined
    DD(`Found ${remaining} remaining fixtures.`);
    return remaining;
  }

  async function _getGroupStandings(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    DD(`Fetching group standings for stage [${stage}], group [${groupNumber}], category [${category}] in tournament [${tournamentId}]`);
    // Assuming sqlGroupStandings returns a valid SQL view name or subquery string
    const standingsQuery = sqlGroupStandings(winAward);
    const standings = await select(
      `SELECT * FROM ${standingsQuery}
       WHERE tournamentId = ? AND grp = ? AND category = ?`,
      [tournamentId, groupNumber, category]
    );
    DD(`Fetched ${standings.length} standings rows.`);
    return standings; // Returns array of standing objects
  }

  async function _getNumPositionsToUpdate(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    let numPositions;
    // Knockout stages typically determine 1st/2nd place (winner/loser)
    if (stage !== "group") {
        numPositions = 2; // Winner (p:1) and Loser (p:2)
        DD(`Knockout stage [${stage}] requires updating ${numPositions} positions.`);
        return numPositions;
    }

    // For group stages, determine how many teams advance or are placed
    // This might depend on tournament rules, potentially stored elsewhere or derived.
    // Using v_fixture_information implies we look at how many fixtures *depend* on this group.
    // Note: This query might be inefficient or complex. Consider simplifying if possible.
    DD(`Determining number of positions for group stage [${stage}/${groupNumber}] based on dependent fixtures`);
    const [result] = await select(
      `SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(team1Planned, '/p:', -1), '', 1) AS UNSIGNED)) as maxPos1,
              MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(team2Planned, '/p:', -1), '', 1) AS UNSIGNED)) as maxPos2,
              MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(umpireTeamPlanned, '/p:', -1), '', 1) AS UNSIGNED)) as maxPosUmp
       FROM fixtures
       WHERE tournamentId = ?
         AND category = ?
         AND (team1Planned LIKE '~${stage}:${groupNumber}/p:%'
          OR team2Planned LIKE '~${stage}:${groupNumber}/p:%'
          OR umpireTeamPlanned LIKE '~${stage}:${groupNumber}/p:%')`,
      [tournamentId, category]
    );

    numPositions = Math.max(result?.maxPos1 || 0, result?.maxPos2 || 0, result?.maxPosUmp || 0);
    DD(`Group stage [${stage}/${groupNumber}] requires updating ${numPositions} position(s) based on maximum placeholder found.`);
    return numPositions;
  }


  async function _updateDependentFixtures(fixture, standings, numPositions) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    let totalUpdated = 0;

    // Helper to perform the actual update for a specific team field (team1, team2, umpireTeam)
    const updateTeamInFixtures = async (teamField, newValue, placeHolder) => {
      DD(`Updating ${teamField}Id to [${newValue}] where ${teamField}Planned = '${placeHolder}' for tournament [${tournamentId}], category [${category}]`);
      // Use the injected 'update' function from dbHelpers
      const affectedRows = await update(
        `UPDATE fixtures SET ${teamField}Id = ?
         WHERE ${teamField}Planned = ? AND tournamentId = ? AND category = ?`,
        [newValue, placeHolder, tournamentId, category]
      );
      DD(`Affected rows for ${teamField}Id update: ${affectedRows}`);
      return affectedRows; // Return affectedRows count
    };

    // Loop through the number of positions determined by _getNumPositionsToUpdate
    for (let position = 0; position < numPositions; position++) {
      // Construct the placeholder string (e.g., ~group:1/p:1, ~group:1/p:2)
      const placeHolder = `~${stage}:${groupNumber}/p:${position + 1}`;
      // Get the actual team ID from the standings for this position.
      // Use null-aware access (?.) and nullish coalescing (??) for safety.
      const newValue = standings[position]?.team ?? null;

      DD(`Processing position ${position + 1}: Placeholder='${placeHolder}', NewValue='${newValue}'`);

      if (newValue === null) {
          DD(`Skipping updates for position ${position + 1} as calculated team ID is null.`);
          continue; // Skip if the team calculation resulted in null (e.g., not enough teams in standings)
      }

      let updatesForPosition = 0;
      // Update team1Id, team2Id, and umpireTeamId where the planned value matches the placeholder
      updatesForPosition += await updateTeamInFixtures("team1", newValue, placeHolder);
      updatesForPosition += await updateTeamInFixtures("team2", newValue, placeHolder);
      updatesForPosition += await updateTeamInFixtures("umpireTeam", newValue, placeHolder);

      DD(`Total updates for position ${position + 1} ('${placeHolder}' -> ${newValue}): ${updatesForPosition}`);
      totalUpdated += updatesForPosition;
    }
    return totalUpdated; // Return total rows affected across all positions
  }

  // Return the main function configured with dependencies
  return {
    processStageCompletion,
  };
};
