const express = require('express');
const controllerFactory = require('../controllers/users');
const authMiddlewareFactory = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();
  const ctrl = controllerFactory(db);
  // Note: We use a loose auth check for creation to allow registration,
  // but strictly enforce it for modification.
  const auth = authMiddlewareFactory(db);

  // Users
  router.post('/users', ctrl.createUser); // Public registration
  router.put('/users/:id', auth, ctrl.updateUser);
  router.delete('/users/:id', auth, ctrl.deleteUser);
  router.get('/users/:id', auth, ctrl.getUser);

  // Roles
  router.post('/roles', auth, ctrl.createRole);
  router.put('/roles/:id', auth, ctrl.updateRole);
  router.delete('/roles/:id', auth, ctrl.deleteRole);

  return router;
};
