const { II } = require("../../lib/logging");
const fixturesService = require("../services/fixtures");

module.exports = (db) => {
  const dbSvc = fixturesService(db);

  return {
    updateCalculatedFixtures: async (req, res) => {
      const { tournamentId, fixtureId } = req.params;
      try {
        const fixtures = await dbSvc.updateCalculatedFixtures(tournamentId, id);
        res.json({ data: fixtures });
      } catch (err) {
        throw err;
      }
    },

    fixturesByPitch: async (req, res) => {
      const { tournamentId, pitch } = req.params;
      try {
        const fixtures = await dbSvc.getFixturesByPitch(tournamentId, pitch);
        res.json({ data: fixtures });
      } catch (err) {
        throw err;
      }
    },

    getFixture: async (req, res) => {
      II(`in endpong getFixture`);
      const tournamentId = req.params.tournamentId;
      const fixtureId = req.params.fixtureId;
      try {
        const fixture = await dbSvc.getFixture(tournamentId, fixtureId);
        res.json({ data: fixture });
      } catch (err) {
        console.error("Error in getFixture:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    },

    nextFixtures: async (req, res) => {
      const { tournamentId } = req.params;
      try {
        const fixtures = await dbSvc.getNextFixtures(tournamentId);
        res.json({ data: fixtures });
      } catch (err) {
        throw err;
      }
    },

    rewindFixture: async (req, res) => {
      const { tournamentId } = req.params;
      try {
        const { id, category, stage } = await dbSvc.rewindLatestFixture(tournamentId);
        res.json({ message: `Removed score for category [${category}] fixture [${id}] stage [${stage}]` });
      } catch (err) {
        throw err;
      }
    },

    startFixture: async (req, res) => {
      const { tournamentId, id } = req.params;
      try {
        const result = await dbSvc.startFixture(id);
        res.json({ data: result });
      } catch (err) {
        res.status(500).json({ error: "Internal server error" });
      }
    },

    reschedule: async (req, res) => {
      const { tournamentId, id } = req.params;
      const { fixtureId, placement, targetPitch } = req.body;
      const data = { 
        operation: 'reschedule',
        targetPitch,
        tournamentId, 
        fixtureId: id,
        relativeFixtureId:  fixtureId,
        placement,
      }
      try {
        const result = await dbSvc.reschedule(data);
        res.json({ data: result });
      } catch (err) {
        console.error("Error in reschedule:", err);
        res.status(500).json({ error: "Internal server error in reschedule" });
      }
    },

    updateScore: async (req, res) => {
      const { tournamentId, id } = req.params;
      const { scores, outcome } = req.body;
      const { team1, team2 } = scores;
      try {
        await dbSvc.updateScore(tournamentId, id, team1, team2, outcome);
        res.json({ message: "Score updated successfully" });
      } catch (err) {
        throw err;
      }
    },

    cardPlayers: async (req, res) => {
      const { tournamentId, id } = req.params;
      try {
        console.log('CARDING PLAYER')
        console.log(req.body)
        /*
          {
            id: 99,
            team: 'Eindhoven A',
            cardColor: 'black',
            playerNumber: '33',
            playerName: 'Not provided',
            confirmed: true
          }
          */
        const result = await dbSvc.cardPlayers(tournamentId, id, card);
        res.json({ data: result });
      } catch (err) {
        throw err;
      }
    },

    getCardedPlayers: async (req, res) => {
      const { id: tournamentId } = req.params;
      try {
        if (!tournamentId) {
          return res.status(400).json({ error: "Tournament ID is required" });
        }
        const players = await dbSvc.getCardedPlayers(tournamentId);
        res.json(players);
      } catch (err) {
        console.error("Error in getCardedPlayers:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    },

  };
};
