import express from 'express';
import controllerFactory from '../../controllers/users';
import authMiddlewareFactory from '../../middleware/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router();
  const ctrl = controllerFactory(db);
  const auth = authMiddlewareFactory(db, useMock);

  // Users
  router.post('/users', ctrl.createUser);
  router.put('/users/:id', auth, ctrl.updateUser);
  router.delete('/users/:id', auth, ctrl.deleteUser);
  router.get('/users/:id', auth, ctrl.getUser);

  // Roles
  router.post('/roles', auth, ctrl.createRole);
  router.put('/roles/:id', auth, ctrl.updateRole);
  router.delete('/roles/:id', auth, ctrl.deleteRole);

  return router;
};
