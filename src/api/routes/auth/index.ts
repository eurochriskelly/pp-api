import express from 'express';
import authController from '../../controllers/auth';

export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = authController(db, useMock);

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
