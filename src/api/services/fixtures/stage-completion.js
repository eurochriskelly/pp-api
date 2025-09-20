const {
  deriveGroupPlaceholderAssignments,
  deriveCategoryPlaceholderAssignments,
} = require('./stage-completion-utils');

// Note: Dependencies are injected by the factory function pattern
// Required dependencies: dbHelpers (select, update), loggers (II, DD), sqlGroupStandings, sqlGroupRankings

module.exports = ({ dbHelpers, loggers, sqlGroupStandings }) => {
  const { select, update } = dbHelpers;
  const { II, DD } = loggers;
  const winAward = 3;
  const standingsQuery = sqlGroupStandings(winAward);

  const fetchFixturesForPlaceholder = async (
    tournamentId,
    category,
    teamField,
    placeHolder
  ) => {
    const idColumn = `${teamField}Id`;
    const plannedColumn = `${teamField}Planned`;

    return await select(
      `SELECT id, ${idColumn} AS teamId, ${plannedColumn} AS planned
         FROM fixtures
         WHERE tournamentId = ?
           AND category = ?
           AND ${plannedColumn} = ?`,
      [tournamentId, category, placeHolder]
    );
  };

  const logPlaceholderDelta = (
    tournamentId,
    category,
    teamField,
    placeHolder,
    beforeRows,
    afterRows
  ) => {
    if (beforeRows.length === 0 && afterRows.length === 0) {
      DD(
        `StageCompletion: no fixtures reference ${teamField} placeholder '${placeHolder}' in tournament ${tournamentId} / category ${category}.`
      );
      return;
    }

    const previous = new Map(beforeRows.map((row) => [row.id, row]));

    if (afterRows.length === 0) {
      II(
        `StageCompletion: fixtures referencing ${teamField} placeholder '${placeHolder}' were removed before logging (tournament ${tournamentId}, category ${category}).`
      );
      return;
    }

    afterRows.forEach(({ id, teamId, planned }) => {
      const before = previous.get(id);
      const beforeLabel = before?.teamId ?? before?.planned ?? 'n/a';
      if (!before) {
        II(
          `StageCompletion: fixture ${id} newly references ${teamField} placeholder '${placeHolder}' (resolved value '${teamId ?? 'pending'}').`
        );
        return;
      }

      if (teamId && teamId !== planned && teamId !== before.teamId) {
        II(
          `StageCompletion: fixture ${id} resolved ${teamField} placeholder '${placeHolder}' from '${beforeLabel}' to '${teamId}'.`
        );
      } else if (before.teamId !== teamId) {
        II(
          `StageCompletion: fixture ${id} ${teamField} placeholder '${placeHolder}' changed value from '${beforeLabel}' to '${teamId ?? planned}'.`
        );
      } else if (!teamId || teamId === planned) {
        DD(
          `StageCompletion: fixture ${id} still pending for ${teamField} placeholder '${placeHolder}'.`
        );
      } else {
        DD(
          `StageCompletion: fixture ${id} already had ${teamField} placeholder '${placeHolder}' resolved to '${teamId}'.`
        );
      }
    });
  };

  async function processStageCompletion(fixtureId) {
    II(`Processing stage completion check for fixture [${fixtureId}]...`);

    const fixture = await _getFixtureDetails(fixtureId);
    if (!fixture) {
      II(`Fixture [${fixtureId}] not found. Aborting stage completion check.`);
      return false;
    }
    const { tournamentId, stage, groupNumber, category } = fixture;
    const remainingCount = await _getRemainingFixtureCount(fixture);
    if (remainingCount === 0) {
      II(
        `Stage [${stage}/${groupNumber}/${category}] for tournament [${tournamentId}] is complete.`
      );

      const standings = await _getGroupStandings(fixture);
      if (!standings || standings.length === 0) {
        II(
          `No standings found for completed stage [${stage}/${groupNumber}/${category}]. Cannot update dependent fixtures.`
        );
        return false;
      }

      const { groupPositions, bestPositions, groupZeroPositions } =
        await _getNumPositionsToUpdate(fixture);
      if (groupPositions === 0 && bestPositions === 0 && groupZeroPositions === 0) {
        II(
          `Determined 0 positions to update for stage [${stage}/${groupNumber}/${category}]. No dependent fixtures will be updated.`
        );
        return false;
      }

      II(
        `Updating positions in dependent fixtures based on stage [${stage}/${groupNumber}/${category}] standings...`
      );
      const totalUpdated = await _updateDependentFixtures(
        fixture,
        standings,
        groupPositions,
        bestPositions,
        groupZeroPositions
      );
      II(
        `Finished updating dependent fixtures. Total rows affected: ${totalUpdated}.`
      );
      return totalUpdated > 0;
    } else {
      II(
        `Stage [${stage}/${groupNumber}/${category}] has ${remainingCount} remaining match(es). No updates needed yet.`
      );
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
    DD(
      `Checking remaining fixtures for stage [${stage}], group [${groupNumber}], category [${category}] in tournament [${tournamentId}]`
    );
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
    DD(
      `Fetching group standings for stage [${stage}], group [${groupNumber}], category [${category}] in tournament [${tournamentId}]`
    );
    const standings = await select(
      `SELECT * FROM ${standingsQuery}
       WHERE tournamentId = ? AND grp = ? AND category = ?`,
      [tournamentId, groupNumber, category]
    );
    DD(`Fetched ${standings.length} standings rows.`);
    return standings;
  }

  async function _getCategoryStandings({ tournamentId, category }) {
    DD(
      `Fetching category standings for tournament [${tournamentId}], category [${category}] across all groups.`
    );
    const standings = await select(
      `SELECT * FROM ${standingsQuery}
       WHERE tournamentId = ? AND category = ?`,
      [tournamentId, category]
    );
    DD(`Fetched ${standings.length} category standing rows.`);
    return standings;
  }

  async function _getRemainingCategoryGroupMatches({
    tournamentId,
    category,
  }) {
    const [result] = await select(
      `SELECT count(*) as remaining
         FROM fixtures
         WHERE tournamentId = ?
           AND category = ?
           AND stage = 'group'
           AND goals1 IS NULL`,
      [tournamentId, category]
    );
    const remaining = result?.remaining ?? 0;
    DD(
      `Remaining unresolved group fixtures for tournament [${tournamentId}], category [${category}]: ${remaining}`
    );
    return remaining;
  }

  async function _getNumPositionsToUpdate(fixture) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    DD(
      `Determining number of positions for stage [${stage}/${groupNumber}] based on dependent fixtures`
    );

    const [groupResult] = await select(
      `SELECT MAX(CAST(SUBSTRING_INDEX(team1Planned, '/p:', -1) AS UNSIGNED)) as maxPos1,
              MAX(CAST(SUBSTRING_INDEX(team2Planned, '/p:', -1) AS UNSIGNED)) as maxPos2,
              MAX(CAST(SUBSTRING_INDEX(umpireTeamPlanned, '/p:', -1) AS UNSIGNED)) as maxPosUmp
       FROM fixtures
       WHERE tournamentId = ? AND category = ?
         AND (team1Planned LIKE ?
           OR team2Planned LIKE ?
           OR umpireTeamPlanned LIKE ?)`,
      [
        tournamentId,
        category,
        `~${stage}:${groupNumber}/p:%`,
        `~${stage}:${groupNumber}/p:%`,
        `~${stage}:${groupNumber}/p:%`,
      ]
    );

    DD(
      `Determining number of bests for stage [${stage}/${groupNumber}] based on dependent fixtures`
    );

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

    const [groupZeroResult] = await select(
      `SELECT MAX(CAST(SUBSTRING_INDEX(team1Planned, '/p:', -1) AS UNSIGNED)) as maxPos1,
              MAX(CAST(SUBSTRING_INDEX(team2Planned, '/p:', -1) AS UNSIGNED)) as maxPos2,
              MAX(CAST(SUBSTRING_INDEX(umpireTeamPlanned, '/p:', -1) AS UNSIGNED)) as maxPosUmp
       FROM fixtures
       WHERE tournamentId = ? AND category = ?
         AND (team1Planned LIKE '~group:0/p:%'
           OR team2Planned LIKE '~group:0/p:%'
           OR umpireTeamPlanned LIKE '~group:0/p:%')`,
      [tournamentId, category]
    );

    const groupPositions = Math.max(
      groupResult?.maxPos1 || 0,
      groupResult?.maxPos2 || 0,
      groupResult?.maxPosUmp || 0
    );
    const bestPositions = Math.max(
      bestResult?.maxPos1 || 0,
      bestResult?.maxPos2 || 0,
      bestResult?.maxPosUmp || 0
    );
    const groupZeroPositions = Math.max(
      groupZeroResult?.maxPos1 || 0,
      groupZeroResult?.maxPos2 || 0,
      groupZeroResult?.maxPosUmp || 0
    );

    DD(
      `Group stage requires updating ${groupPositions} position(s). Best-of rankings require updating ${bestPositions} position(s). All-group placeholders require updating ${groupZeroPositions} position(s).`
    );
    return { groupPositions, bestPositions, groupZeroPositions };
  }

  async function _updateDependentFixtures(
    fixture,
    standings,
    groupPositions,
    bestPositions,
    groupZeroPositions
  ) {
    const { tournamentId, stage, groupNumber, category } = fixture;
    let totalUpdated = 0;

    const updateTeamInFixtures = async (teamField, newValue, placeHolder) => {
      const beforeRows = await fetchFixturesForPlaceholder(
        tournamentId,
        category,
        teamField,
        placeHolder
      );
      if (beforeRows.length === 0) {
        DD(
          `StageCompletion: no fixtures found for ${teamField} placeholder '${placeHolder}' prior to update in tournament ${tournamentId} / category ${category}.`
        );
      } else {
        DD(
          `StageCompletion: preparing to resolve ${teamField} placeholder '${placeHolder}' for ${beforeRows.length} fixture(s).`
        );
      }

      const affectedRows = await update(
        `UPDATE fixtures SET ${teamField}Id = ?
         WHERE ${teamField}Planned = ? AND tournamentId = ? AND category = ?`,
        [newValue, placeHolder, tournamentId, category]
      );
      DD(
        `StageCompletion: ${teamField} placeholder '${placeHolder}' update affected ${affectedRows} row(s).`
      );

      const afterRows = await fetchFixturesForPlaceholder(
        tournamentId,
        category,
        teamField,
        placeHolder
      );

      logPlaceholderDelta(
        tournamentId,
        category,
        teamField,
        placeHolder,
        beforeRows,
        afterRows
      );
      return affectedRows;
    };

    const groupAssignments = deriveGroupPlaceholderAssignments({
      stage,
      groupNumber,
      totalPositions: groupPositions,
      standings,
    });

    for (let index = 0; index < groupAssignments.length; index += 1) {
      const { placeholder, teamId } = groupAssignments[index];
      const positionNumber = index + 1;

      if (!teamId) {
        DD(
          `Skipping updates for position ${positionNumber} as calculated team ID is null.`
        );
        continue;
      }

      let updatesForPosition = 0;
      updatesForPosition += await updateTeamInFixtures(
        'team1',
        teamId,
        placeholder
      );
      updatesForPosition += await updateTeamInFixtures(
        'team2',
        teamId,
        placeholder
      );
      updatesForPosition += await updateTeamInFixtures(
        'umpireTeam',
        teamId,
        placeholder
      );

      DD(
        `Total updates for position ${positionNumber} ('${placeholder}' -> ${teamId}): ${updatesForPosition}`
      );
      totalUpdated += updatesForPosition;
    }

    const bestRankCache = {};
    for (let pos = 1; pos <= bestPositions; pos++) {
      if (!bestRankCache[pos]) {
        bestRankCache[pos] = 0; // await select(query, []);
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
        updatesForBest += await updateTeamInFixtures(
          'team1',
          teamId,
          placeHolder
        );
        updatesForBest += await updateTeamInFixtures(
          'team2',
          teamId,
          placeHolder
        );
        updatesForBest += await updateTeamInFixtures(
          'umpireTeam',
          teamId,
          placeHolder
        );

        DD(
          `Best placeholder ${placeHolder} resolved to team ${teamId}, updated ${updatesForBest} rows`
        );
        totalUpdated += updatesForBest;
      }
    }

    if (groupZeroPositions > 0) {
      const remainingCategoryMatches =
        await _getRemainingCategoryGroupMatches({ tournamentId, category });
      if (remainingCategoryMatches > 0) {
        II(
          `StageCompletion: skipping ~group:0 updates for tournament [${tournamentId}], category [${category}] because ${remainingCategoryMatches} group match(es) remain.`
        );
      } else {
        const categoryStandings = await _getCategoryStandings({
          tournamentId,
          category,
        });

        const categoryAssignments = deriveCategoryPlaceholderAssignments({
          standings: categoryStandings,
          totalPositions: groupZeroPositions,
        });

        for (let index = 0; index < categoryAssignments.length; index += 1) {
          const { placeholder, teamId } = categoryAssignments[index];

          if (!teamId) {
            II(
              `StageCompletion: insufficient category standings to resolve placeholder '${placeholder}' for tournament [${tournamentId}], category [${category}].`
            );
            continue;
          }

          let updatesForAllGroups = 0;
          updatesForAllGroups += await updateTeamInFixtures(
            'team1',
            teamId,
            placeholder
          );
          updatesForAllGroups += await updateTeamInFixtures(
            'team2',
            teamId,
            placeholder
          );
          updatesForAllGroups += await updateTeamInFixtures(
            'umpireTeam',
            teamId,
            placeholder
          );

          if (updatesForAllGroups === 0) {
            DD(
              `StageCompletion: placeholder '${placeholder}' already resolved to team '${teamId}' across all fixtures.`
            );
          }
          totalUpdated += updatesForAllGroups;
        }
      }
    }

    return totalUpdated;
  }

  return {
    processStageCompletion,
  };
};
