// Note: Dependencies are injected by the factory function pattern
// Required dependencies: dbHelpers (select, update), loggers (II, DD), sqlGroupStandings, sqlGroupRankings

module.exports = ({ dbHelpers, loggers, sqlGroupStandings, sqlGroupRankings }) => {
  const { select, update } = dbHelpers;
  const { II, DD } = loggers;
  const winAward = 3;

  async function processStageCompletion(fixtureId) {
    II(`LLLL Processing stage completion check for fixture [${fixtureId}]...`);

    const fixture = await _getFixtureDetails(fixtureId);
    if (!fixture) {
      II(`Fixture [${fixtureId}] not found. Aborting stage completion check.`);
      return false;
    }
    const { tournamentId, stage, groupNumber, category } = fixture;
    const remainingCount = await _getRemainingFixtureCount(fixture);
    console.log("LLLL remainingCount", remainingCount)
    if (remainingCount === 0) {
      II(`LLL Stage [${stage}/${groupNumber}/${category}] for tournament [${tournamentId}] is complete.`);

      const standings = await _getGroupStandings(fixture);
      if (!standings || standings.length === 0) {
        II(`No standings found for completed stage [${stage}/${groupNumber}/${category}]. Cannot update dependent fixtures.`);
        return false;
      }
      console.log('LLLL ------ stadings are', standings);

      const { groupPositions, bestPositions } = await _getNumPositionsToUpdate(fixture);
      if (groupPositions === 0 && bestPositions === 0) {
        II(`Determined 0 positions to update for stage [${stage}/${groupNumber}/${category}]. No dependent fixtures will be updated.`);
        return false;
      }

      II(`Updating positions in dependent fixtures based on stage [${stage}/${groupNumber}/${category}] standings...`);
      const totalUpdated = await _updateDependentFixtures(fixture, standings, groupPositions, bestPositions);
      II(`Finished updating dependent fixtures. Total rows affected: ${totalUpdated}.`);
      return totalUpdated > 0;
    } else {
      II(`Stage [${stage}/${groupNumber}/${category}] has ${remainingCount} remaining match(es). No updates needed yet.`);
      return false;
    }
  }

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
    return fixture;
  }

  async function _getRemainingFixtureCount(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    DD(`Checking remaining fixtures for stage [${stage}], group [${groupNumber}], category [${category}] in tournament [${tournamentId}]`);
    const [result] = await select(
      `SELECT count(*) as remaining FROM fixtures
       WHERE tournamentId = ? AND stage = ? AND groupNumber = ? AND category = ? AND goals1 IS NULL`,
      [tournamentId, stage, groupNumber, category]
    );
    const remaining = result?.remaining ?? 0;
    DD(`Found ${remaining} remaining fixtures.`);
    return remaining;
  }

  async function _getGroupStandings(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    DD(`Fetching group standings for stage [${stage}], group [${groupNumber}], category [${category}] in tournament [${tournamentId}]`);
    const standingsQuery = sqlGroupStandings(winAward);
    const standings = await select(
      `SELECT * FROM ${standingsQuery}
       WHERE tournamentId = ? AND grp = ? AND category = ?`,
      [tournamentId, groupNumber, category]
    );
    DD(`Fetched ${standings.length} standings rows.`);
    return standings;
  }

  async function _getNumPositionsToUpdate(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    DD(`Determining number of positions for stage [${stage}/${groupNumber}] based on dependent fixtures`);

    const [groupResult] = await select(
      `SELECT MAX(CAST(SUBSTRING_INDEX(team1Planned, '/p:', -1) AS UNSIGNED)) as maxPos1,
              MAX(CAST(SUBSTRING_INDEX(team2Planned, '/p:', -1) AS UNSIGNED)) as maxPos2,
              MAX(CAST(SUBSTRING_INDEX(umpireTeamPlanned, '/p:', -1) AS UNSIGNED)) as maxPosUmp
       FROM fixtures
       WHERE tournamentId = ? AND category = ?
         AND (team1Planned LIKE ?
           OR team2Planned LIKE ?
           OR umpireTeamPlanned LIKE ?)`,
      [tournamentId, category, `~${stage}:${groupNumber}/p:%`, `~${stage}:${groupNumber}/p:%`, `~${stage}:${groupNumber}/p:%`]
    );

    DD(`Determining number of bests for stage [${stage}/${groupNumber}] based on dependent fixtures`);

    const [bestResult] = await select(
      `SELECT MAX(CAST(SUBSTRING_INDEX(team1Planned, '/p:', -1) AS UNSIGNED)) as maxPos1,
              MAX(CAST(SUBSTRING_INDEX(team2Planned, '/p:', -1) AS UNSIGNED)) as maxPos2,
              MAX(CAST(SUBSTRING_INDEX(umpireTeamPlanned, '/p:', -1) AS UNSIGNED)) as maxPosUmp
       FROM fixtures
       WHERE tournamentId = ? AND category = ?
         AND (team1Planned LIKE '~best:%/p:%'
           OR team2Planned LIKE '~best:%/p:%'
           OR umpireTeamPlanned LIKE '~best:%/p:%')`,
      [tournamentId, category]
    );

    const groupPositions = Math.max(groupResult?.maxPos1 || 0, groupResult?.maxPos2 || 0, groupResult?.maxPosUmp || 0);
    const bestPositions = Math.max(bestResult?.maxPos1 || 0, bestResult?.maxPos2 || 0, bestResult?.maxPosUmp || 0);

    DD(`Group stage requires updating ${groupPositions} position(s). Best-of rankings require updating ${bestPositions} position(s).`);
    return { groupPositions, bestPositions };
  }

  async function _updateDependentFixtures(fixture, standings, groupPositions, bestPositions) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    let totalUpdated = 0;

    const updateTeamInFixtures = async (teamField, newValue, placeHolder) => {
      DD(`Updating ${teamField}Id to [${newValue}] where ${teamField}Planned = '${placeHolder}' for tournament [${tournamentId}], category [${category}]`);
      const affectedRows = await update(
        `UPDATE fixtures SET ${teamField}Id = ?
         WHERE ${teamField}Planned = ? AND tournamentId = ? AND category = ?`,
        [newValue, placeHolder, tournamentId, category]
      );
      DD(`Affected rows for ${teamField}Id update: ${affectedRows}`);
      return affectedRows;
    };

    for (let position = 0; position < groupPositions; position++) {
      const placeHolder = `~${stage}:${groupNumber}/p:${position + 1}`;
      const newValue = standings[position]?.team ?? null;
      if (newValue === null) {
        DD(`Skipping updates for position ${position + 1} as calculated team ID is null.`);
        continue;
      }

      let updatesForPosition = 0;
      updatesForPosition += await updateTeamInFixtures("team1", newValue, placeHolder);
      updatesForPosition += await updateTeamInFixtures("team2", newValue, placeHolder);
      updatesForPosition += await updateTeamInFixtures("umpireTeam", newValue, placeHolder);

      DD(`Total updates for position ${position + 1} ('${placeHolder}' -> ${newValue}): ${updatesForPosition}`);
      totalUpdated += updatesForPosition;
    }

    const bestRankCache = {};
    for (let pos = 1; pos <= bestPositions; pos++) {
      if (!bestRankCache[pos]) {
        const query = sqlGroupRankings(pos);
        bestRankCache[pos] = await select(query, []);
      }

      const rankedTeams = bestRankCache[pos];
      for (let x = 1; x <= rankedTeams.length; x++) {
        const placeHolder = `~best:${x}/p:${pos}`;
        const teamId = rankedTeams[x - 1]?.team ?? null;
        if (!teamId) {
          DD(`Skipping best placeholder ${placeHolder} — not enough teams`);
          continue;
        }

        let updatesForBest = 0;
        updatesForBest += await updateTeamInFixtures("team1", teamId, placeHolder);
        updatesForBest += await updateTeamInFixtures("team2", teamId, placeHolder);
        updatesForBest += await updateTeamInFixtures("umpireTeam", teamId, placeHolder);

        DD(`Best placeholder ${placeHolder} resolved to team ${teamId}, updated ${updatesForBest} rows`);
        totalUpdated += updatesForBest;
      }
    }

    return totalUpdated;
  }

  return {
    processStageCompletion,
  };
};

