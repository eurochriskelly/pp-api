import express from 'express';
import authController from '../../controllers/auth';

export default (dbs: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const dbMain = dbs.main || dbs;
  const ctrl = authController(dbMain, useMock);

  router.post('/signup', ctrl.signup);
  router.post('/verify', ctrl.verify);
  router.post('/register', ctrl.register);
  router.post('/login', ctrl.login);
  router.post('/logout', ctrl.logout);
  router.get('/me', ctrl.getCurrentUser);
  router.get('/users', ctrl.getUsers);
  router.post('/check-email', ctrl.checkEmail);

  return router;
};
