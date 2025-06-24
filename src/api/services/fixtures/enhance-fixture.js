// File: fixtureProcessor.js

const CategoryCompositionManager = require('./enhance-fixture/category-composition-manager');
const FixtureLaneManager = require('./enhance-fixture/fixture-lane-manager');
const FixtureInfringementManager = require('./enhance-fixture/fixture-infringement-manager');

module.exports = ({ dbHelpers, loggers }) => {
  const { select } = dbHelpers;
  const { DD } = loggers;

  const embellishedFixtureCache = new Map();

  const categoryManager = new CategoryCompositionManager({
    select,
    logger: DD,
  });
  const laneManager = new FixtureLaneManager({ select, logger: DD });
  const infringementManager = new FixtureInfringementManager({
    select,
    logger: DD,
  });

  async function embellishFixture(fixture, options = {}, categoryCompositions) {
    if (!fixture) return null;

    const cacheKey = `${fixture.id}-${fixture.updated}`;
    let baseEmbellished;

    if (embellishedFixtureCache.has(cacheKey)) {
      DD(`Using cached embellished fixture for key [${cacheKey}]`);
      baseEmbellished = embellishedFixtureCache.get(cacheKey);
    } else {
      DD(
        `No cache hit for key [${cacheKey}]. Calculating embellished fixture.`
      );
      const compositions =
        categoryCompositions ||
        (await categoryManager.getOrCalculate(fixture.tournamentId));
      const currentLane = await laneManager.getCurrentLane(fixture);
      const allowedLanes = await laneManager.getAllowedLanes(
        fixture,
        currentLane
      );
      const competitionData = compositions.get(fixture.category) || {
        offset: -1,
        initial: 'N/A',
      };

      let cards = [];
      if (fixture.id && fixture.tournamentId) {
        DD(
          `Fetching card data for fixture [${fixture.id}], tournament [${fixture.tournamentId}].`
        );
        cards = await select(
          `SELECT id, category, playerNumber, playerName, cardColor, team FROM cards WHERE tournamentId = ? AND fixtureId = ?`,
          [fixture.tournamentId, fixture.id]
        );
        DD(`Found ${cards.length} cards for fixture [${fixture.id}].`);
      } else {
        DD(
          `Fixture ID or tournament ID missing for fixture (ID: ${fixture.id}, TID: ${fixture.tournamentId}), card data will be an empty array.`
        );
      }

      baseEmbellished = {
        ...fixture,
        team1: fixture.team1Id || fixture.team1,
        team2: fixture.team2Id || fixture.team2,
        lane: { current: currentLane, allowedLanes },
        competition: {
          offset: competitionData.offset,
          initials: competitionData.initial,
          matchId: `${competitionData.initial}.${`${fixture.id}`.slice(-2)}`,
        },
        umpireTeam: fixture.umpireTeamId || fixture.umpireTeam,
        scheduledTime: fixture.scheduled
          ? fixture.scheduled.toTimeString().substring(0, 5)
          : null,
        startedTime: fixture.started
          ? fixture.started.toTimeString().substring(0, 5)
          : null,
        isResult: !!(fixture.goals1 === 0 || fixture.goals1),
        played: fixture.outcome !== 'not played' && fixture.ended,
        cards,
        infringements: { team1: [], team2: [] },
      };

      await infringementManager.processTeamInfringements(
        baseEmbellished,
        baseEmbellished.team1,
        baseEmbellished.infringements.team1,
        currentLane
      );
      await infringementManager.processTeamInfringements(
        baseEmbellished,
        baseEmbellished.team2,
        baseEmbellished.infringements.team2,
        currentLane
      );

      embellishedFixtureCache.set(cacheKey, baseEmbellished);
    }

    const finalEmbellished = {
      ...baseEmbellished,
      cardedPlayers: options.cardedPlayers ? baseEmbellished.cards : undefined,
    };

    return finalEmbellished;
  }
  return {
    embellishFixture,
    getOrCalculateTournamentCategoryCompositions:
      categoryManager.getOrCalculate.bind(categoryManager),
  };
};
