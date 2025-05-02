const { II } = require("../../lib/logging");
const fixturesService = require("../services/fixtures");
const { z } = require('zod'); // Import Zod

// Define Zod schema for a single card object in the request body
const cardPlayerSchema = z.object({
  // 'id' is the primary key of the card record itself. Nullable/optional for inserts.
  id: z.number().int().positive().nullable().optional(),
  team: z.string({ required_error: "Team is required" }).min(1, { message: "Team cannot be empty" }),
  cardColor: z.enum(['yellow', 'red', 'black'], { required_error: "Card color is required", invalid_type_error: "Invalid card color" }),
  // Add playerNumber and playerName - assuming they are strings and can be empty
  playerNumber: z.number({ required_error: "playerNumber is required" }),
  playerName: z.string({ required_error: "playerName is required" }),
}).passthrough(); // Allow other fields like confirmed


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

    endFixture: async (req, res) => {
      const { tournamentId, id } = req.params;
      try {
        const result = await dbSvc.endixture(id);
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
        // Call the service method with the validated data directly.
        // The service expects an object with an 'id' field (player's ID), cardColor, and team.
        // validatedCardData already has this structure.
        const result = await dbSvc.cardPlayers(tournamentId, fixtureId, validatedCardData);
        res.json({ data: result });
      } catch (err) {
         // Log the error for server-side inspection
        console.error(`Error in cardPlayers controller for fixture [${fixtureId}]:`, err);

        // Reverted: Handle potential errors (like DB connection issues, constraints)
        // Send a generic 500 error to the client
        // The foreign key constraint error will now result in a 500 again,
        // which might be acceptable if the client ensures valid player IDs.
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

    deleteCard: async (req, res) => {
      // Note: The route uses ':id' for fixtureId
      const { tournamentId, id: fixtureId, cardId } = req.params;

      // Basic validation for cardId
      const cardIdNum = parseInt(cardId, 10);
      if (isNaN(cardIdNum) || cardIdNum <= 0) {
          return res.status(400).json({ error: "Invalid Card ID format." });
      }

      try {
        II(`Processing deleteCard request for tournament [${tournamentId}], fixture [${fixtureId}], card [${cardIdNum}]`);
        const result = await dbSvc.deleteCard(tournamentId, fixtureId, cardIdNum);

        if (result.cardDeleted) {
          res.status(200).json({ message: `Card with ID ${cardIdNum} deleted successfully.` });
        } else {
          // If the service returns cardDeleted: false, it means the card wasn't found
          res.status(404).json({ error: `Card with ID ${cardIdNum} not found for the specified tournament/fixture.` });
        }
      } catch (err) {
        console.error(`Error in deleteCard controller for card [${cardIdNum}]:`, err);
        res.status(500).json({ error: "Internal server error while deleting card." });
      }
    },

  };
};
