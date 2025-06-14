// File: fixtureProcessor.js
const InitialGenerator = require('./enhance-fixture/initial-generator');
const CategoryCompositionManager = require('./enhance-fixture/category-composition-manager');
const FixtureLaneManager = require('./enhance-fixture/fixture-lane-manager');
const FixtureInfringementManager = require('./enhance-fixture/fixture-infringement-manager');

module.exports = ({ dbHelpers, loggers }) => {
  const { select } = dbHelpers;
  const { DD } = loggers;

  const categoryManager = new CategoryCompositionManager({ select, logger: DD });
  const laneManager = new FixtureLaneManager({ select, logger: DD });
  const infringementManager = new FixtureInfringementManager({ select, logger: DD });

  async function embellishFixture(fixture, options = {}, categoryCompositions) {
    if (!fixture) return null;

    const compositions = categoryCompositions || await categoryManager.getOrCalculate(fixture.tournamentId);
    const currentLane = await laneManager.getCurrentLane(fixture);
    const allowedLanes = await laneManager.getAllowedLanes(fixture, currentLane);
    const competitionData = compositions.get(fixture.category) || { offset: -1, initial: 'N/A' };

    let cards = [];
    if (fixture.id && fixture.tournamentId) {
      DD(`Fetching card data for fixture [${fixture.id}], tournament [${fixture.tournamentId}].`);
      cards = await select(
        `SELECT id, category, playerNumber, playerName, cardColor, team FROM cards WHERE tournamentId = ? AND fixtureId = ?`,
        [fixture.tournamentId, fixture.id]
      );
      DD(`Found ${cards.length} cards for fixture [${fixture.id}].`);
    } else {
      DD(`Fixture ID or tournament ID missing for fixture (ID: ${fixture.id}, TID: ${fixture.tournamentId}), card data will be an empty array.`);
    }

    const embellished = {
      ...fixture,
      team1: fixture.team1Id || fixture.team1,
      team2: fixture.team2Id || fixture.team2,
      lane: { current: currentLane, allowedLanes },
      competition: { 
        offset: competitionData.offset,
        initials: competitionData.initial,
        matchId: `${competitionData.initial}.${`${fixture.id}`.slice(-2)}`
      },
      umpireTeam: fixture.umpireTeamId || fixture.umpireTeam,
      scheduledTime: fixture.scheduled ? fixture.scheduled.toTimeString().substring(0, 5) : null,
      startedTime: fixture.started ? fixture.started.toTimeString().substring(0, 5) : null,
      isResult: !!(fixture.goals1 === 0 || fixture.goals1),
      played: fixture.outcome !== 'not played' && fixture.ended,
      cards,
      cardedPlayers: options.cardedPlayers ? cards : undefined,
      infringements: { team1: [], team2: [] }
    };

    await infringementManager.processTeamInfringements(embellished, embellished.team1, embellished.infringements.team1, currentLane);
    await infringementManager.processTeamInfringements(embellished, embellished.team2, embellished.infringements.team2, currentLane);

    return embellished;
  }
  return {
    embellishFixture,
    getOrCalculateTournamentCategoryCompositions: categoryManager.getOrCalculate.bind(categoryManager)
  };
};
