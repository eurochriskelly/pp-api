// Manages fixture lane logic
class FixtureLaneManager {
  constructor({ select, logger }) {
    this.select = select;
    this.logger = logger;
  }

  async getCurrentLane(fixture) {
    if (!fixture?.started) {
      if (
        fixture.pitch &&
        fixture.tournamentId &&
        typeof fixture.id !== 'undefined'
      ) {
        const nextUnstartedOnPitch = await this.select(
          `SELECT id FROM fixtures 
           WHERE tournamentId = ? AND pitch = ? AND started IS NULL 
           ORDER BY scheduled ASC, id ASC 
           LIMIT 1`,
          [fixture.tournamentId, fixture.pitch]
        );

        if (
          nextUnstartedOnPitch.length > 0 &&
          nextUnstartedOnPitch[0].id === fixture.id
        ) {
          this.logger(
            `Fixture [${fixture.id}] is the next unstarted on pitch [${fixture.pitch}]. Lane: 'queued'.`
          );
          return 'queued';
        }
        this.logger(
          `Fixture [${fixture.id}] is planned but not the next on pitch [${fixture.pitch}]. Lane: 'planned'.`
        );
        return 'planned';
      }
      this.logger(
        `Fixture [${fixture.id}] missing pitch, tournamentId, or id for 'queued' check. Defaulting to 'planned'.`
      );
      return 'planned';
    }
    if (fixture.started && !fixture.ended) return 'started';
    if (fixture.started && fixture.ended) return 'finished';

    console.error(
      `Invalid fixture state for lane determination: ${JSON.stringify(fixture, null, 2)}`
    );
    return 'planned';
  }

  async getAllowedLanes(fixture, currentLane) {
    const defaultAllowed = ['planned', 'queued', 'started', 'finished'];
    const team1Identifier = String(fixture.team1Id || fixture.team1 || '');
    const team2Identifier = String(fixture.team2Id || fixture.team2 || '');

    if (team1Identifier.startsWith('~') || team2Identifier.startsWith('~')) {
      this.logger(
        `Fixture [${fixture.id}] (Tournament: ${fixture.tournamentId}): Team identifier (${team1Identifier} or ${team2Identifier}) starts with '~'. Allowed lanes restricted to ['planned'].`
      );
      return ['planned'];
    }

    let finalAllowedLanes = [...defaultAllowed];
    if (
      fixture.pitch &&
      fixture.tournamentId &&
      typeof fixture.id !== 'undefined'
    ) {
      const ongoingFixturesOnPitch = await this.select(
        `SELECT 1 FROM fixtures 
         WHERE tournamentId = ? AND pitch = ? AND started IS NOT NULL AND ended IS NULL AND id != ? 
         LIMIT 1`,
        [fixture.tournamentId, fixture.pitch, fixture.id]
      );

      if (ongoingFixturesOnPitch.length > 0) {
        this.logger(
          `Fixture [${fixture.id}] (Tournament: ${fixture.tournamentId}, Pitch: ${fixture.pitch}): Another match on the same pitch is 'started'. Removing 'started' from allowed lanes for this fixture.`
        );
        finalAllowedLanes = finalAllowedLanes.filter(
          (lane) => lane !== 'started'
        );
      }
    } else {
      const missingFields = [];
      if (!fixture.pitch) missingFields.push('pitch');
      if (!fixture.tournamentId) missingFields.push('tournamentId');
      if (typeof fixture.id === 'undefined') missingFields.push('id');
      this.logger(
        `Fixture (ID: ${fixture.id}, Tournament: ${fixture.tournamentId}, Pitch: ${fixture.pitch}): Skipping Pitch Occupancy check for allowedLanes due to missing field(s): ${missingFields.join(', ')}.`
      );
    }

    if (currentLane === 'planned') {
      this.logger(
        `Fixture [${fixture.id}] (Tournament: ${fixture.tournamentId}): Current lane is 'planned'. Removing 'started' from allowed lanes as it must be 'queued' first.`
      );
      finalAllowedLanes = finalAllowedLanes.filter(
        (lane) => lane !== 'started'
      );
    }

    return finalAllowedLanes;
  }
}

module.exports = FixtureLaneManager;
