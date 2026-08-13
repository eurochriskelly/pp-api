import express from 'express';
import authController from '../../controllers/auth';
import authMiddlewareFactory from '../../middleware/auth';
import requireRole from '../../middleware/authorization';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = authController(dbMain, useMock);
  const auth = authMiddlewareFactory(dbMain, useMock);
  const requireAdmin = requireRole(['admin']);

  router.post('/signup', ctrl.signup);
  router.post('/verify', ctrl.verify);
  router.post('/register', ctrl.register);
  router.post('/login', ctrl.login);
  router.post('/logout', auth, ctrl.logout);
  router.get('/me', auth, ctrl.getCurrentUser);
  router.get('/users', auth, requireAdmin, ctrl.getUsers);
  router.post('/check-email', ctrl.checkEmail);

  return router;
};
