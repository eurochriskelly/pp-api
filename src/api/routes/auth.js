const express = require('express');
const authController = require('../controllers/auth');

module.exports = (db, useMock) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = authController(db, useMock);

  router.post('/signup', ctrl.signup);
  router.post('/login', ctrl.login);
  router.post('/logout', ctrl.logout); // POST is common for logout to allow sending token in body
  router.get('/me', ctrl.getCurrentUser); // Endpoint to verify token and get user info

  return router;
};
