const serviceFactory = require('../services/users');

module.exports = (db) => {
  const service = serviceFactory(db);

  return {
    createUser: async (req, res) => {
      try {
        const result = await service.createUser(req.body);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },
    updateUser: async (req, res) => {
      try {
        const result = await service.updateUser(req.params.id, req.body);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },
    deleteUser: async (req, res) => {
      try {
        const result = await service.deleteUser(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },
    getUser: async (req, res) => {
      try {
        const result = await service.getUser(req.params.id);
        if (!result) return res.status(404).json({ error: 'Not found' });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
    // Roles
    createRole: async (req, res) => {
      try {
        const result = await service.createRole(req.body);
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },
    updateRole: async (req, res) => {
      try {
        const result = await service.updateRole(req.params.id, req.body);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },
    deleteRole: async (req, res) => {
      try {
        const result = await service.deleteRole(req.params.id);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    },
  };
};
