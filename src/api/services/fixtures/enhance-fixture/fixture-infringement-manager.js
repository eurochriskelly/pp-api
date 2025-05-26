// Manages fixture infringements
class FixtureInfringementManager {
  constructor({ select, logger }) {
    this.select = select;
    this.logger = logger;
  }

  isPlaceholderTeam(name) {
    return typeof name === 'string' && (name.startsWith('~') || name.toLowerCase() === 'bye');
  }

  async processTeamInfringements(fixture, teamName, teamInfringementArray, currentLane) {
    if (!fixture.scheduled) {
      this.logger(`Skipping infringement calculation for team [${teamName}] in fixture [${fixture.id}] because current fixture scheduled time is null.`);
      return;
    }
    if (!teamName || this.isPlaceholderTeam(teamName)) {
      this.logger(`Skipping infringement calculation for placeholder or invalid team: ${teamName} in fixture [${fixture.id}]`);
      return;
    }

    // Expulsions
    this.logger(`Calculating expulsions for team [${teamName}] for fixture [${fixture.id}] scheduled at [${fixture.scheduled}]`);
    const expelledPlayers = await this.select(
      `SELECT DISTINCT c.playerNumber, c.playerName
       FROM cards c
       JOIN fixtures f ON c.fixtureId = f.id
       WHERE c.tournamentId = ? AND c.team = ? AND c.cardColor = 'red'
         AND ( (f.scheduled < ?) OR (f.scheduled = ? AND f.id < ?) )`,
      [fixture.tournamentId, teamName, fixture.scheduled, fixture.scheduled, fixture.id]
    );
    expelledPlayers.forEach(p => {
      this.logger(`Player [${p.playerName}, ${p.playerNumber}] from team [${teamName}] marked as expelled.`);
      teamInfringementArray.push({ playerNumber: p.playerNumber, playerName: p.playerName, penalty: 'expulsion' });
    });

    // Suspensions
    if (['queued', 'started'].includes(currentLane)) {
      this.logger(`Calculating suspensions for team [${teamName}] (current lane: ${currentLane})`);
      const lastTwoPlayedFixtures = await this.select(
        `SELECT f_hist.id FROM fixtures f_hist
         WHERE f_hist.tournamentId = ? 
           AND (f_hist.team1Id = ? OR f_hist.team2Id = ?)
           AND f_hist.outcome = 'played' AND f_hist.ended IS NOT NULL
           AND ( (f_hist.scheduled < ?) OR (f_hist.scheduled = ? AND f_hist.id < ?) )
         ORDER BY f_hist.ended DESC LIMIT 2`,
        [fixture.tournamentId, teamName, teamName, fixture.scheduled, fixture.scheduled, fixture.id]
      );

      if (lastTwoPlayedFixtures.length > 0) {
        const prevFixtureIds = lastTwoPlayedFixtures.map(f => f.id);
        this.logger(`Found ${prevFixtureIds.length} previous played fixtures for team [${teamName}]: ${prevFixtureIds.join(', ')}`);

        const cardsInPrevFixtures = await this.select(
          `SELECT c.playerNumber, c.playerName, c.cardColor FROM cards c
           WHERE c.tournamentId = ? AND c.team = ? AND c.fixtureId IN (${prevFixtureIds.map(() => '?').join(',')})
             AND (c.cardColor = 'yellow' OR c.cardColor = 'black')`,
          [fixture.tournamentId, teamName, ...prevFixtureIds]
        );

        const playerCardCounts = cardsInPrevFixtures.reduce((acc, card) => {
          const key = `${card.playerNumber}-${card.playerName}`;
          if (!acc[key]) {
            acc[key] = { playerNumber: card.playerNumber, playerName: card.playerName, count: 0 };
          }
          acc[key].count++;
          return acc;
        }, {});

        Object.values(playerCardCounts).forEach(p => {
          if (p.count >= 2) {
            const isAlreadyExpelled = teamInfringementArray.some(
              exp => exp.playerNumber === p.playerNumber && exp.playerName === p.playerName && exp.penalty === 'expulsion'
            );
            if (!isAlreadyExpelled) {
              this.logger(`Player [${p.playerName}, ${p.playerNumber}] from team [${teamName}] marked as suspended (card count: ${p.count}).`);
              teamInfringementArray.push({ playerNumber: p.playerNumber, playerName: p.playerName, penalty: 'suspension' });
            } else {
              this.logger(`Player [${p.playerName}, ${p.playerNumber}] from team [${teamName}] meets suspension criteria but is already expelled.`);
            }
          }
        });
      } else {
        this.logger(`No previous played fixtures found for team [${teamName}] to calculate suspensions.`);
      }
    }
  }
}

module.exports = FixtureInfringementManager;
