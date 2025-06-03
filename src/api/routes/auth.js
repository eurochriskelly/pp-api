const express = require("express");
const authController = require("../controllers/auth");

module.exports = (db, useMock) => {
  const router = express.Router({mergeParams: true});
  const ctrl = authController(db, useMock);

  router.post("/login", ctrl.login);

  return router;
};
