
// Cache for category compositions per tournament
const tournamentCategoryCompositionsCache = new Map();

// Helper to generate primary initial from category name
function _generateInitialFromName(categoryName) {
  if (!categoryName) return "N/A";
  const tokens = categoryName.split(/[\s-_]+/);
  let initial = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) { // If token is purely numeric
      initial += token;
    } else if (token.length > 0) {
      initial += token.charAt(0);
    }
  }
  return initial.toUpperCase().substring(0, 3);
}

module.exports = ({ dbHelpers, loggers }) => {
  const { select } = dbHelpers;
  const { DD } = loggers;

  // Helper to calculate all category compositions for a tournament
  async function _calculateCategoryCompositions(tournamentId) {
    DD(`Calculating category compositions for tournament [${tournamentId}]`);
    const categories = await select(
      `SELECT DISTINCT category FROM fixtures WHERE tournamentId = ? ORDER BY category ASC`,
      [tournamentId]
    );

    const categoryMetadataMap = new Map();
    const usedInitials = new Set();
    let singleLetterDisambiguationChar = 'A'; // For "Beavers" (B), "Cubs" (C), "Bears" (B -> D) like conflicts

    for (const [idx, catRow] of categories.entries()) {
      const categoryName = catRow.category;
      const offset = idx;
      let initial = _generateInitialFromName(categoryName);

      if (usedInitials.has(initial)) {
        DD(`Initial conflict for category "${categoryName}": initial "${initial}" already used.`);
        const primaryInitialTokens = categoryName.split(/[\s-_]+/);
        // Check if the category name is effectively a single word (ignoring purely numeric parts for this check)
        const nonNumericTokens = primaryInitialTokens.filter(t => !/^\d+$/.test(t));
        const isSingleConceptWordCategory = nonNumericTokens.length === 1;

        if (initial.length === 1 && isSingleConceptWordCategory) {
          // Conflict on a single-letter initial from a single-word category (e.g., "Bears" conflicted on "B")
          let uniqueFoundViaLetterFallback = false;
          let attemptChar = singleLetterDisambiguationChar;
          while (attemptChar <= 'Z') {
            if (!usedInitials.has(attemptChar)) {
              initial = attemptChar;
              singleLetterDisambiguationChar = String.fromCharCode(attemptChar.charCodeAt(0) + 1);
              uniqueFoundViaLetterFallback = true;
              DD(`Resolved conflict for "${categoryName}" (was "${_generateInitialFromName(categoryName)}") to "${initial}" using letter fallback.`);
              break;
            }
            attemptChar = String.fromCharCode(attemptChar.charCodeAt(0) + 1);
          }
          if (!uniqueFoundViaLetterFallback) {
            // Exhausted A-Z, try numeric appending to the original conflicting single letter initial
            DD(`Letter fallback exhausted for "${categoryName}". Trying numeric append to "${_generateInitialFromName(categoryName)}".`);
            let count = 1;
            const baseForNumeric = _generateInitialFromName(categoryName); // The original 'B'
            let tempInitial;
            do {
              let numStr = String(count++);
              if (baseForNumeric.length + numStr.length <= 3) {
                tempInitial = baseForNumeric + numStr;
              } else { // Should only happen if base is long, but here base is 1 char
                tempInitial = (baseForNumeric.substring(0, 3 - numStr.length) + numStr).substring(0, 3);
              }
            } while (usedInitials.has(tempInitial) && count < 100);
            initial = tempInitial;
            DD(`Resolved conflict for "${categoryName}" to "${initial}" using numeric append after letter fallback exhaustion.`);
          }
        } else {
          // General conflict (not the single-letter-single-word type, or fallback from it failed)
          DD(`General conflict for "${categoryName}" (initial "${initial}"). Using numeric append.`);
          let count = 1;
          const baseForNumeric = _generateInitialFromName(categoryName);
          let tempInitial;
          do {
            let numStr = String(count++);
            let prefix = baseForNumeric;
            if (baseForNumeric.length + numStr.length > 3) {
              prefix = baseForNumeric.substring(0, Math.max(0, 3 - numStr.length));
            }

            if (prefix.length === 0 && numStr.length <= 3) {
              tempInitial = numStr;
            } else if (prefix.length === 0) {
              tempInitial = "ERR"; // Should not happen with count < 100
              break;
            } else {
              tempInitial = prefix + numStr;
            }
            tempInitial = tempInitial.substring(0, 3); // Ensure always 3 chars or less

          } while (usedInitials.has(tempInitial) && count < 100);
          initial = tempInitial;
          DD(`Resolved general conflict for "${categoryName}" to "${initial}" using numeric append.`);
        }
      }
      usedInitials.add(initial);
      categoryMetadataMap.set(categoryName, { offset, initial });
      DD(`Category "${categoryName}": offset=${offset}, initial="${initial}"`);
    }
    return categoryMetadataMap;
  }

  // Manages caching for category compositions
  async function getOrCalculateTournamentCategoryCompositions(tournamentId) {
    if (tournamentCategoryCompositionsCache.has(tournamentId)) {
      DD(`Using cached category compositions for tournament [${tournamentId}]`);
      return tournamentCategoryCompositionsCache.get(tournamentId);
    }
    const compositions = await _calculateCategoryCompositions(tournamentId); // select and DD are in closure
    tournamentCategoryCompositionsCache.set(tournamentId, compositions);
    return compositions;
  }

  // Define embellishFixture inside the factory to access 'select', 'DD', and category compositions
  async function embellishFixture(fixture, options = {}, categoryCompositions) {
    if (!fixture) return null; // Handle null fixture input

    // getCurrentLane is now async and uses 'fixture', 'select', 'DD' from its closure
    const getCurrentLane = async () => {
      // if started is null, determine if 'queued' or 'planned'
      if (!fixture?.started) {
        if (fixture.pitch && fixture.tournamentId && typeof fixture.id !== 'undefined') {
          const nextUnstartedOnPitch = await select(
            `SELECT id FROM fixtures 
             WHERE tournamentId = ? AND pitch = ? AND started IS NULL 
             ORDER BY scheduled ASC, id ASC 
             LIMIT 1`,
            [fixture.tournamentId, fixture.pitch]
          );

          if (nextUnstartedOnPitch.length > 0 && nextUnstartedOnPitch[0].id === fixture.id) {
            DD(`Fixture [${fixture.id}] is the next unstarted on pitch [${fixture.pitch}]. Lane: 'queued'.`);
            return 'queued';
          }
          DD(`Fixture [${fixture.id}] is planned but not the next on pitch [${fixture.pitch}]. Lane: 'planned'.`);
          return 'planned';
        }
        // If essential fields are missing for the query, default to 'planned'
        DD(`Fixture [${fixture.id}] missing pitch, tournamentId, or id for 'queued' check. Defaulting to 'planned'.`);
        return 'planned';
      }
      // if started is not null but ended is null, lane.current = 'started'
      if (fixture?.started && !fixture?.ended) return 'started';
      // if started is not null and ended is true, lane.current = 'finished'
      if (fixture?.started && fixture?.ended) return 'finished';

      // This state should ideally not be reached if fixture states are consistent
      console.error(`Invalid fixture state for lane determination: ${JSON.stringify(fixture, null, 2)}`);
      // Fallback or throw error, 'planned' might be a safer default if an unexpected state occurs
      return 'planned';
    }

    // getAllowedLanes is now async and uses 'fixture', 'select', 'DD' from its closure
    const getAllowedLanes = async (currentLaneValue) => {
      let defaultAllowed = ['planned', 'queued', 'started', 'finished']; // 'started' for 'ongoing'

      // Rule 2: If team1Id or team2Id (or their fallbacks team1/team2) starts with "~", allowedLanes is ['planned']
      const team1Identifier = String(fixture.team1Id || fixture.team1 || '');
      const team2Identifier = String(fixture.team2Id || fixture.team2 || '');

      if (team1Identifier.startsWith('~') || team2Identifier.startsWith('~')) {
        DD(`Fixture [${fixture.id}] (Tournament: ${fixture.tournamentId}): Team identifier (${team1Identifier} or ${team2Identifier}) starts with '~'. Allowed lanes restricted to ['planned'].`);
        return ['planned'];
      }

      // Pitch Occupancy Check: If another fixture is 'started' on the same pitch, this fixture cannot be 'started'.
      // This check is performed if Rule 2 (tilde identifier check) did not cause an early return.
      let finalAllowedLanes = [...defaultAllowed];

      // Ensure fixture.pitch, fixture.tournamentId, and fixture.id are present for the query
      if (fixture.pitch && fixture.tournamentId && typeof fixture.id !== 'undefined') {
        const ongoingFixturesOnPitch = await select(
          `SELECT 1 FROM fixtures 
             WHERE tournamentId = ? AND pitch = ? AND started IS NOT NULL AND ended IS NULL AND id != ? 
             LIMIT 1`,
          [fixture.tournamentId, fixture.pitch, fixture.id]
        );

        if (ongoingFixturesOnPitch.length > 0) {
          DD(`Fixture [${fixture.id}] (Tournament: ${fixture.tournamentId}, Pitch: ${fixture.pitch}): Another match on the same pitch is 'started'. Removing 'started' from allowed lanes for this fixture.`);
          finalAllowedLanes = finalAllowedLanes.filter(lane => lane !== 'started');
        }
      } else {
        // Log if essential fields are missing for this check
        let missingFields = [];
        if (!fixture.pitch) missingFields.push("pitch");
        if (!fixture.tournamentId) missingFields.push("tournamentId");
        if (typeof fixture.id === 'undefined') missingFields.push("id");
        DD(`Fixture (ID: ${fixture.id}, Tournament: ${fixture.tournamentId}, Pitch: ${fixture.pitch}): Skipping Pitch Occupancy check for allowedLanes due to missing field(s): ${missingFields.join(', ')}.`);
      }

      // New Rule: If current lane is 'planned', it cannot go directly to 'started'.
      // It must first be 'queued'.
      if (currentLaneValue === 'planned') {
        DD(`Fixture [${fixture.id}] (Tournament: ${fixture.tournamentId}): Current lane is 'planned'. Removing 'started' from allowed lanes as it must be 'queued' first.`);
        finalAllowedLanes = finalAllowedLanes.filter(lane => lane !== 'started');
      }

      return finalAllowedLanes;
    };

    const currentLane = await getCurrentLane(); // Await the async function
    const resolvedAllowedLanes = await getAllowedLanes(currentLane); // Call the async function

    const competitionData = categoryCompositions.get(fixture.category) || { offset: -1, initial: "N/A" }; // Fallback

    const embellished = {
      ...fixture,
      // todo: get rid v_fixture_information. Centralize abstractions in the code.
      team1: fixture.team1Id || fixture.team1,
      team2: fixture.team2Id || fixture.team2,
      lane: {
        current: currentLane,
        allowedLanes: resolvedAllowedLanes, // Use the dynamically calculated allowedLanes
      },
      competition: {
        offset: competitionData.offset,
        initials: competitionData.initial, // Field name 'initials' as per prompt
      },
      umpireTeam: fixture.umpireTeamId || fixture.umpireTeam,
      scheduledTime: fixture.scheduled
        ? `${fixture.scheduled.toTimeString()}`?.substring(0, 5)
        : null,
      startedTime: fixture.started
        ? `${fixture.started.toTimeString()}`?.substring(0, 5)
        : null,
      isResult: !!(fixture.goals1 === 0 || fixture.goals1),
      played: fixture.outcome != 'not played' && fixture.ended
    };

    let fetchedCards = [];
    if (fixture.id && fixture.tournamentId) {
      DD(`Fetching card data for fixture [${fixture.id}], tournament [${fixture.tournamentId}].`);
      fetchedCards = await select(
        `SELECT id, playerNumber, playerName, cardColor, team FROM cards WHERE tournamentId = ? AND fixtureId = ?`,
        [fixture.tournamentId, fixture.id]
      );
      DD(`Found ${fetchedCards.length} cards for fixture [${fixture.id}].`);
    } else {
      DD(`Fixture ID or tournament ID missing for fixture (ID: ${fixture.id}, TID: ${fixture.tournamentId}), card data will be an empty array.`);
      // fetchedCards is already initialized to []
    }

    embellished.cards = fetchedCards; // Add the new 'cards' property

    if (options.cardedPlayers) {
      DD(`Option 'cardedPlayers' is true. Populating 'cardedPlayers' property for fixture [${fixture.id || 'N/A'}].`);
      embellished.cardedPlayers = fetchedCards; // Use the fetched data
    }

    // --- Infringements ---
    embellished.infringements = { team1: [], team2: [] };
    const { tournamentId, scheduled: currentFixtureScheduled, team1: team1Name, team2: team2Name } = embellished;

    const isPlaceholderTeam = (name) => typeof name === 'string' && (name.startsWith('~') || name.toLowerCase() === 'bye');

    const processTeamInfringements = async (teamName, teamInfringementArray) => {
      if (!teamName || isPlaceholderTeam(teamName)) {
        DD(`Skipping infringement calculation for placeholder or invalid team: ${teamName}`);
        return;
      }

      // Expulsions
      DD(`Calculating expulsions for team [${teamName}] for fixture scheduled at [${currentFixtureScheduled}]`);
      const expelledPlayers = await select(
        `SELECT DISTINCT c.playerNumber, c.playerName
         FROM cards c
         JOIN fixtures f ON c.fixtureId = f.id
         WHERE c.tournamentId = ? AND c.team = ? AND c.cardColor = 'red'
           AND f.scheduled < ?`,
        [tournamentId, teamName, currentFixtureScheduled]
      );
      expelledPlayers.forEach(p => {
        DD(`Player [${p.playerName}, ${p.playerNumber}] from team [${teamName}] marked as expelled.`);
        teamInfringementArray.push({ playerNumber: p.playerNumber, playerName: p.playerName, penalty: "expulsion" });
      });

      // Suspensions (if currentLane is 'queued' or 'started')
      if (['queued', 'started'].includes(currentLane)) {
        DD(`Calculating suspensions for team [${teamName}] (current lane: ${currentLane})`);
        const lastTwoPlayedFixtures = await select(
          `SELECT f_hist.id FROM fixtures f_hist
           WHERE f_hist.tournamentId = ? 
             AND (f_hist.team1Id = ? OR f_hist.team2Id = ?)
             AND f_hist.outcome = 'played' AND f_hist.ended IS NOT NULL
             AND f_hist.scheduled < ?
           ORDER BY f_hist.scheduled DESC LIMIT 2`,
          [tournamentId, teamName, teamName, currentFixtureScheduled]
        );

        if (lastTwoPlayedFixtures.length > 0) {
          const prevFixtureIds = lastTwoPlayedFixtures.map(f => f.id);
          DD(`Found ${prevFixtureIds.length} previous played fixtures for team [${teamName}]: ${prevFixtureIds.join(', ')}`);
          
          const cardsInPrevFixtures = await select(
            `SELECT c.playerNumber, c.playerName, c.cardColor FROM cards c
             WHERE c.tournamentId = ? AND c.team = ? AND c.fixtureId IN (${prevFixtureIds.map(() => '?').join(',')})
               AND (c.cardColor = 'yellow' OR c.cardColor = 'black')`,
            [tournamentId, teamName, ...prevFixtureIds]
          );

          const playerCardCounts = cardsInPrevFixtures.reduce((acc, card) => {
            const key = `${card.playerNumber}-${card.playerName}`; // Use playerNumber and playerName as a composite key
            if (!acc[key]) {
              acc[key] = { playerNumber: card.playerNumber, playerName: card.playerName, count: 0 };
            }
            acc[key].count++;
            return acc;
          }, {});

          Object.values(playerCardCounts).forEach(p => {
            if (p.count >= 2) {
              const isAlreadyExpelled = teamInfringementArray.some(
                exp => exp.playerNumber === p.playerNumber && exp.playerName === p.playerName && exp.penalty === "expulsion"
              );
              if (!isAlreadyExpelled) {
                DD(`Player [${p.playerName}, ${p.playerNumber}] from team [${teamName}] marked as suspended (card count: ${p.count}).`);
                teamInfringementArray.push({ playerNumber: p.playerNumber, playerName: p.playerName, penalty: "suspension" });
              } else {
                DD(`Player [${p.playerName}, ${p.playerNumber}] from team [${teamName}] meets suspension criteria but is already expelled.`);
              }
            }
          });
        } else {
          DD(`No previous played fixtures found for team [${teamName}] to calculate suspensions.`);
        }
      }
    };

    await processTeamInfringements(team1Name, embellished.infringements.team1);
    await processTeamInfringements(team2Name, embellished.infringements.team2);
    // --- End Infringements ---

    return embellished;
  }

  return {
    embellishFixture,
    getOrCalculateTournamentCategoryCompositions
  };
};
