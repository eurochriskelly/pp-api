/**
The FixtureInfringementManager class should find 2 types of infringements applicable to a fixture.

1. Expulsions for red cards
2. Suspensions for yellow cards.

1. Expulsions are easy to find. 

Select all cards for a given tournamentId and competition/(category) where cardColor = yellow
e.g. SELECT * from cards WHERE tournamentId=1 and cardColor='red' and team in ('team1', 'team2');
Expelled players should show up for all fixtures. The player is out for the day and the referee and officials should know so when 
looking at any match.

2. Suspensions are more nuanced.

A suspension only applies to the next unplayed match for the team to which it applies. For example, if a player gets a yellow in 2 matches 
in a row, then that player must be suspended for the next game. Black cards are treated the same as yellow. Also, if a player gets a 2 yellows, 
a black and a yellow or 2 black cards in the same match that is to be treated as a temporary suspension of one match. To add some nuance, if a player
got 2 yellows 2 matches ago, then don't show a suspension on the next fixture because it must have already been served.

If a player

*/

// Manages fixture infringements
class FixtureInfringementManager {
  constructor({ select, logger }) {
    this.select = select;
    this.logger = logger;
  }

  isPlaceholderTeam(name) {
    return (
      typeof name === 'string' &&
      (name.startsWith('~') || name.toLowerCase() === 'bye')
    );
  }

  async processTeamInfringements(
    fixture,
    teamName,
    teamInfringementArray,
    currentLane
  ) {
    this.logger('🔍 fixture fields:', Object.entries(fixture));

    if (!fixture.scheduled) {
      this.logger(
        `Skipping infringement calculation for team [${teamName}] in fixture [${fixture.id}] because current fixture scheduled time is null.`
      );
      return;
    }
    if (!teamName || this.isPlaceholderTeam(teamName)) {
      this.logger(
        `Skipping infringement calculation for placeholder or invalid team: ${teamName} in fixture [${fixture.id}]`
      );
      return;
    }

    // Expulsions: anyone sent off today in this category sits out all fixtures today
    this.logger(
      `Calculating expulsions for team [${teamName}] in fixture [${fixture.id}] on [${fixture.scheduled}] (category: ${fixture.category})`
    );

    // 1) First, grab all reds *regardless* of category — just to see who’s in play
    const allToday = await this.select(
      `
      SELECT DISTINCT c.playerNumber, c.playerName, c.category, DATE(f.scheduled) AS day
        FROM cards c
        JOIN fixtures f ON c.fixtureId = f.id
       WHERE c.tournamentId = ?
         AND c.team      = ?
         AND c.cardColor = 'red'
         AND DATE(f.scheduled) = DATE(?)
      `,
      [fixture.tournamentId, teamName, fixture.scheduled]
    );
    this.logger(`🔍 all reds today (${allToday.length}):`, allToday);

    // 2) Now filter by category
    const expelledPlayers = await this.select(
      `
      SELECT DISTINCT c.playerNumber, c.playerName, c.category
        FROM cards c
        JOIN fixtures f ON c.fixtureId = f.id
       WHERE c.tournamentId = ?
         AND c.team      = ?
         AND c.cardColor = 'red'
         AND c.category  = ?
         AND DATE(f.scheduled) = DATE(?)
      `,
      [fixture.tournamentId, teamName, fixture.category, fixture.scheduled]
    );
    this.logger(
      `🔍 reds in category [${fixture.category}] (${expelledPlayers.length}):`,
      expelledPlayers
    );

    // 3) Mark them expelled
    expelledPlayers.forEach((p) => {
      this.logger(
        `→ marking expelled: [${p.playerName} #${p.playerNumber}] (card.category=${p.category})`
      );
      teamInfringementArray.push({
        playerNumber: p.playerNumber,
        playerName: p.playerName,
        penalty: 'expulsion',
      });
    });

    if (['queued', 'started'].includes(currentLane)) {
      // 1) Find the most recent played fixture for this team
      const sqlLast = `
    SELECT f_hist.id
      FROM fixtures f_hist
     WHERE f_hist.tournamentId = ?
       AND (f_hist.team1Id = ? OR f_hist.team2Id = ?)
       AND f_hist.outcome = 'played'
       AND f_hist.ended IS NOT NULL
       AND (
         (f_hist.scheduled < ?)
         OR (f_hist.scheduled = ? AND f_hist.id < ?)
       )
    ORDER BY f_hist.ended DESC
    LIMIT 1
  `;
      const paramsLast = [
        fixture.tournamentId,
        teamName,
        teamName,
        fixture.scheduled,
        fixture.scheduled,
        fixture.id,
      ];
      this.logger('🔍 last played fixture SQL:', sqlLast.trim(), paramsLast);
      const lastPlayed = await this.select(sqlLast, paramsLast);

      if (lastPlayed.length === 0) {
        this.logger(
          `No previous played fixture for team [${teamName}]; no suspension check.`
        );
        return;
      }

      const prevId = lastPlayed[0].id;
      this.logger(
        `Found last played fixture [${prevId}] for team [${teamName}]`
      );

      // 2) Fetch all yellow/black cards from that fixture
      const sqlCards = `
    SELECT c.playerNumber, c.playerName, c.cardColor
      FROM cards c
     WHERE c.tournamentId = ?
       AND c.team        = ?
       AND c.fixtureId   = ?
       AND (c.cardColor = 'yellow' OR c.cardColor = 'black')
  `;
      const paramsCards = [fixture.tournamentId, teamName, prevId];
      this.logger(
        '🔍 cards in last fixture SQL:',
        sqlCards.trim(),
        paramsCards
      );
      const cards = await this.select(sqlCards, paramsCards);

      // 3) Count per player in that one match
      const counts = cards.reduce((acc, { playerNumber, playerName }) => {
        const key = `${playerNumber}-${playerName}`;
        acc[key] = acc[key] || { playerNumber, playerName, count: 0 };
        acc[key].count++;
        return acc;
      }, {});
      this.logger('🔍 card counts in last fixture:', Object.values(counts));

      // 4) If any player got 2+ cards in that fixture, suspend them now
      Object.values(counts).forEach((p) => {
        if (p.count >= 2) {
          const alreadyExpelled = teamInfringementArray.some(
            (inf) =>
              inf.playerNumber === p.playerNumber && inf.penalty === 'expulsion'
          );
          if (!alreadyExpelled) {
            this.logger(
              `→ suspending ${p.playerName} (#${p.playerNumber}) for next fixture`
            );
            teamInfringementArray.push({
              playerNumber: p.playerNumber,
              playerName: p.playerName,
              penalty: 'suspension',
            });
          } else {
            this.logger(
              `→ skip suspension for ${p.playerName}; already expelled`
            );
          }
        }
      });
    }
  }
}

module.exports = FixtureInfringementManager;
