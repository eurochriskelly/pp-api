module.exports = (db, useMock) => {
  const serviceFactory = useMock
    ? require('../services/mocks/clubs')
    : require('../services/clubs');
  const dbSvc = serviceFactory(db);

  return {
    listClubs: async (req, res) => {
      const { search, limit = 10 } = req.query;
      try {
        const clubs = await dbSvc.listClubs(search, parseInt(limit));
        res.json({ data: clubs });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    getClubById: async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid club ID' });
        }

        const club = await dbSvc.getClubById(id);
        if (!club) {
          return res.status(404).json({ error: 'Club not found' });
        }

        res.json({ data: club });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    createClub: async (req, res) => {
      try {
        const { clubName } = req.body;
        if (!clubName) {
          return res.status(400).json({ error: 'clubName is required' });
        }

        const club = await dbSvc.createClub(req.body);
        res.status(201).json({ data: club });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },

    updateClub: async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid club ID' });
        }

        const club = await dbSvc.updateClub(id, req.body);
        res.json({ data: club });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },

    deleteClub: async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid club ID' });
        }

        const result = await dbSvc.deleteClub(id);
        res.json({ data: result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    uploadLogo: async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid club ID' });
        }

        if (!req.body || req.body.length === 0) {
          return res.status(400).json({ error: 'Logo data is required' });
        }

        const result = await dbSvc.uploadLogo(id, req.body);
        res.json({ data: result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    getLogo: async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid club ID' });
        }

        const logo = await dbSvc.getLogo(id);
        if (!logo) {
          return res.status(404).json({ error: 'Logo not found' });
        }

        res.set('Content-Type', 'image/png');
        res.send(logo);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  };
};
