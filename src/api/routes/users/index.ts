import express from 'express';
import controllerFactory from '../../controllers/users';
import generalController from '../../controllers/general';
import authMiddlewareFactory from '../../middleware/auth';
import requireRole from '../../middleware/authorization';
import { validateNumericId } from '../../middleware/validation';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router();
  const dbMain = dbs.main || dbs;
  const ctrl = controllerFactory(dbMain, useMock);
  const generalCtrl = generalController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);
  const requireAdmin = requireRole(['admin']);

  // Users
  router.get('/users', auth, requireAdmin, generalCtrl.getUsers);
  router.post('/users', auth, requireAdmin, ctrl.createUser);
  router.put(
    '/users/:userId',
    auth,
    validateNumericId('userId'),
    ctrl.updateUser
  );
  router.delete(
    '/users/:userId',
    auth,
    validateNumericId('userId'),
    ctrl.deleteUser
  );
  router.get('/users/:userId', auth, validateNumericId('userId'), ctrl.getUser);

  // Roles
  router.post('/roles', auth, ctrl.createRole);
  router.put(
    '/roles/:roleId',
    auth,
    validateNumericId('roleId'),
    ctrl.updateRole
  );
  router.delete(
    '/roles/:roleId',
    auth,
    validateNumericId('roleId'),
    ctrl.deleteRole
  );

  return router;
};
