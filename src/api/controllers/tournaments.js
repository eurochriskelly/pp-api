module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/tournaments')
    : require('../services/tournaments');
  const dbSvc = serviceFactory(db);

  return {
    // Tournament CRUD
    validateTsv: handleRoute((req, res) => {
      const tsvEncoded = req.body.key;
      const { rows, warnings } = dbSvc.validateTsv(tsvEncoded);
      res.json({ data: { rows, warnings } });
    }, 201),

    createTournament: handleRoute(async (req, res) => {
      const {
        userId,
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints = 2,
        drawPoints = 1,
        lossPoints = 0,
      } = req.body;
      const tournament = await dbSvc.createTournament(userId, {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints,
        drawPoints,
        lossPoints,
      });
      console.log('b', tournament);
      res.json(tournament);
    }, 201),

    updateTournament: handleRoute(async (req, res) => {
      const { id } = req.params;
      const {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints = 2,
        drawPoints = 1,
        lossPoints = 0,
      } = req.body;
      await dbSvc.updateTournament(id, {
        region,
        title,
        date,
        location,
        lat,
        lon,
        codeOrganizer,
        winPoints,
        drawPoints,
        lossPoints,
      });
      const tournament = await dbSvc.getTournament(id);
      res.json(tournament);
    }, 200),

    getTournaments: handleRoute(async (req) => {
      const status = req.query.status || 'all';
      const userId = req.query.userId;
      const role = req.query.role;
      const tournaments = await dbSvc.getTournaments(status, userId, role);
      return { data: tournaments };
    }),

    getTournamentReport: handleRoute(async (req) => {
      const { id } = req.params;
      const report = await dbSvc.buildTournamentReport(id);
      return { data: report };
    }),

    buildTournamentReport: handleRoute(async (req) => {
      const { id } = req.params;
      const report = await dbSvc.buildTournamentReport(id);
      return { data: report };
    }),

    generateFixtures: handleRoute(async (req) => {
      const competitionData = req.body;
      const hydratedCompetition = await dbSvc.generateFixtures(competitionData);
      return { data: hydratedCompetition };
    }, 200),

    getFilters: handleRoute(async (req) => {
      const { tournamentId } = req.params;
      const { role, category } = req.query;
      // Basic validation for role
      if (!role) {
        const err = new Error('Role query parameter is required.');
        err.statusCode = 400; // Bad Request
        throw err;
      }
      const filters = await dbSvc.getFilters(tournamentId, role, category);
      return { data: filters };
    }),

    getTournament: async (req, res) => {
      const { id, uuid = null } = req.params;
      const tournament = await dbSvc.getTournament(id, uuid);
      res.json({ data: tournament });
    },

    deleteTournament: async (req, res) => {
      const { id } = req.params;
      await dbSvc.deleteTournament(id);
      res.json({ message: 'Tournament deleted' });
    },

    resetTournament: async (req, res) => {
      const { id } = req.params;
      try {
        await dbSvc.resetTournament(id);
        res.json({ message: 'Tournament reset successfully' });
      } catch (err) {
        console.log(err);
        res.status(403).json({
          message:
            'Only sandbox tournament (id=1) can be reset. See log for more info.',
        });
      }
    },

    // Existing tournament endpoints
    getRecentMatches: async (req, res) => {
      const { id } = req.params;
      const [count, matches] = await Promise.all([
        dbSvc.getStartedMatchCount(id),
        dbSvc.getRecentMatches(id),
      ]);
      res.json({ matchCount: count, matches });
    },

    getMatchesByPitch: async (req, res) => {
      console.log('ok', req.params);
      const { tournamentId } = req.params;
      const matches = await dbSvc.getMatchesByPitch(tournamentId);
      res.json(matches);
    },

    getGroupFixtures: async (req, res) => {
      const { id } = req.params;
      const fixtures = await dbSvc.getGroupFixtures(id);
      res.json(fixtures);
    },

    getGroupStandings: async (req, res) => {
      const { id } = req.params;
      const standings = await dbSvc.getGroupStandings(id);
      res.json(standings);
    },

    getKnockoutFixtures: async (req, res) => {
      const { id } = req.params;
      const fixtures = await dbSvc.getKnockoutFixtures(id);
      res.json(fixtures);
    },

    getFinalsResults: async (req, res) => {
      const { id } = req.params;
      const results = await dbSvc.getFinalsResults(id);
      res.json(results);
    },

    getAllMatches: async (req, res) => {
      const { id } = req.params;
      const matches = await dbSvc.getAllMatches(id);
      res.json(matches);
    },

    getTournamentCategories: async (req, res) => {
      const { id } = req.params;
      const categories = await dbSvc.getTournamentCategories(id);
      res.json(categories);
    },

    getCardedPlayers: async (req, res) => {
      const { tournamentId } = req.params;
      const players = await dbSvc.getCardedPlayers(tournamentId);
      res.json(players);
    },

    // Squads CRUD
    createSquad: async (req, res) => {
      const { tournamentId } = req.params;
      const { teamName, groupLetter, category, teamSheetSubmitted, notes } =
        req.body;
      const id = await dbSvc.createSquad(tournamentId, {
        teamName,
        groupLetter,
        category,
        teamSheetSubmitted,
        notes,
      });
      const squad = await dbSvc.getSquad(tournamentId, id);
      res.status(201).json(squad);
    },

    getSquads: async (req, res) => {
      const { tournamentId } = req.params;
      const squads = await dbSvc.getSquads(tournamentId);
      res.json({ data: squads });
    },

    getSquad: async (req, res) => {
      const { tournamentId, id } = req.params;
      const squad = await dbSvc.getSquad(tournamentId, id);
      res.json({ data: squad });
    },

    updateSquad: async (req, res) => {
      const { tournamentId, id } = req.params;
      const { teamName, groupLetter, category, teamSheetSubmitted, notes } =
        req.body;
      await dbSvc.updateSquad(id, {
        teamName,
        groupLetter,
        category,
        teamSheetSubmitted,
        notes,
      });
      const squad = await dbSvc.getSquad(tournamentId, id);
      res.json(squad);
    },

    deleteSquad: async (req, res) => {
      const { id } = req.params;
      await dbSvc.deleteSquad(id);
      res.json({ message: 'Squad deleted' });
    },

    // Players CRUD
    createPlayer: async (req, res) => {
      const { squadId } = req.params;
      const { firstName, secondName, dateOfBirth, foirreannId } = req.body;
      const id = await dbSvc.createPlayer(squadId, {
        firstName,
        secondName,
        dateOfBirth,
        foirreannId,
      });
      const player = await dbSvc.getPlayer(id);
      res.status(201).json(player);
    },

    getPlayers: async (req, res) => {
      const { squadId } = req.params;
      const players = await dbSvc.getPlayers(squadId);
      res.json({ data: players });
    },

    getPlayer: async (req, res) => {
      const { id } = req.params;
      const player = await dbSvc.getPlayer(id);
      res.json({ data: player });
    },

    updatePlayer: async (req, res) => {
      const { id } = req.params;
      const { firstName, secondName, dateOfBirth, foirreannId } = req.body;
      try {
        await dbSvc.updatePlayer(id, {
          firstName,
          secondName,
          dateOfBirth,
          foirreannId,
        });
        const player = await dbSvc.getPlayer(id);
        res.json(player);
      } catch (err) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    },

    deletePlayer: async (req, res) => {
      const { id } = req.params;
      await dbSvc.deletePlayer(id);
      res.json({ message: 'Player deleted' });
    },

    deleteCards: async (req, res) => {
      const { id } = req.params;
      try {
        await dbSvc.deleteCards(id);
        res.status(200).json({ message: `Cards for tournament ${id} deleted` });
      } catch (err) {
        res.status(500).json({
          error: err.message || 'Internal server error. (deleteCards)',
        });
      }
    },

    deleteFixtures: async (req, res) => {
      const { id } = req.params;
      try {
        await dbSvc.deleteFixtures(id); // Assume this deletes all fixtures for tournamentId
        res
          .status(200)
          .json({ message: `Fixtures for tournament ${id} deleted` });
      } catch (err) {
        res.status(500).json({
          error: err.message || 'Internal server error. (deleteFixtures)',
        });
      }
    },

    deletePitches: async (req, res) => {
      const { id } = req.params;
      try {
        await dbSvc.deletePitches(id);
        res
          .status(200)
          .json({ message: `Pitches for tournament ${id} deleted` });
      } catch (err) {
        res.status(500).json({
          error: err.message || 'Internal server error. (deletePitches)',
        });
      }
    },

    createPitches: async (req, res) => {
      const { id } = req.params;
      const pitches = req.body; // Array of { pitch, location, type, tournamentId }
      try {
        const createdPitches = await dbSvc.createPitches(id, pitches);
        res.status(201).json(createdPitches); // Return created pitches
      } catch (err) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    },

    createFixtures: async (req, res) => {
      const { id } = req.params;
      const fixtures = req.body; // Array of fixture objects
      try {
        const createdFixtures = await dbSvc.createFixtures(id, fixtures);
        res.status(201).json(createdFixtures); // Return created fixtures
      } catch (err) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    },

    codeCheck: async (req, res) => {
      const { id, code } = req.params;
      const { role } = req.query;
      try {
        const result = await dbSvc.codeCheck(id, code.toUpperCase(), role);
        res.status(200).json({
          authorized: result,
          data: { role, tournamentId: id },
        });
      } catch (err) {
        // If the error has a warnings property, return it as well
        res.status(400).json({
          authorized: false,
          data: { role, tournamentId: id },
          error:
            err.message ||
            'Invalid code or internal server error while checking pin code',
          warnings: err.warnings || undefined,
        });
      }
    },

    getTournamentsByStatus: handleRoute(async (req) => {
      const { status } = req.params;
      const { userId, region } = req.query; // Extract region
      const tournaments = await dbSvc.getTournamentsByStatus(
        status,
        userId,
        region
      ); // Pass region
      return { data: tournaments };
    }),

    getTournamentsSummary: handleRoute(async () => {
      const summary = await dbSvc.getTournamentsSummary();
      return { data: summary };
    }),
  };
};

function handleRoute(logic, successStatus = 200) {
  return async (req, res, next) => {
    try {
      const result = await logic(req, res, next);
      // if the route logic already sent a response (e.g., res.json(...)),
      // you can skip this, but often it's convenient if `logic` just returns data.
      // We automatically send a JSON response with the chosen status:
      if (result !== undefined) {
        return res.status(successStatus).json(result);
      }
    } catch (err) {
      return next(err); // Let Express error handler catch it
    }
  };
}
