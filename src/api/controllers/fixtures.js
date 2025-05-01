const { II } = require("../../lib/logging");
const fixturesService = require("../services/fixtures");
const { z } = require('zod'); // Import Zod

// Define Zod schema for a single card object in the request body
const cardPlayerSchema = z.object({
  // Treat 'id' from the input as the playerId for the database
  id: z.number().int().positive({ message: "Player ID (sent as 'id') must be a positive integer" }),
  team: z.string({ required_error: "Team is required" }).min(1, { message: "Team cannot be empty" }),
  cardColor: z.enum(['yellow', 'red', 'black'], { required_error: "Card color is required", invalid_type_error: "Invalid card color" }),
}).passthrough(); // Allow other fields like playerNumber, playerName, confirmed


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
      const { tournamentId, id: fixtureId } = req.params; // Renamed id to fixtureId for clarity

      // Validate request body
      console.log('card', req.body)
      const validationResult = cardPlayerSchema.safeParse(req.body);

      if (!validationResult.success) {
        console.error("CardPlayers validation error:", validationResult.error.flatten());
        // Return a 400 Bad Request with validation errors
        return res.status(400).json({
          message: "Invalid request body for carding players.",
          errors: validationResult.error.flatten().fieldErrors,
        });
      }

      // Use validated data
      const validatedCardData = validationResult.data;

      try {
        II(`Processing cardPlayers request for tournament [${tournamentId}], fixture [${fixtureId}]`);
        // Call the service method to add a single card
        // Map the input 'id' field to 'playerId' for the service
        const cardInput = {
            playerId: validatedCardData.id,
            cardColor: validatedCardData.cardColor,
            team: validatedCardData.team
            // Include other fields from validatedCardData if the service needs them
        };
        const result = await dbSvc.addCard(tournamentId, fixtureId, cardInput); // Changed service call
        res.json({ data: result });
      } catch (err) {
         // Log the error for server-side inspection
        console.error(`Error in cardPlayers controller for fixture [${fixtureId}]:`, err);

        // Check for the specific player not found error
        if (err.code === 'PLAYER_NOT_FOUND') {
          return res.status(404).json({ // 404 Not Found is appropriate here
            message: "Cannot add card: Player not found.",
            error: err.message
          });
        }

        // Handle other potential errors (like DB connection issues, other constraints)
        // Send a generic 500 error to the client
        res.status(500).json({ error: "Internal server error while processing card." });
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
