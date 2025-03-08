const express = require("express");
const authController = require("../controllers/auth");

module.exports = (db) => {
  const router = express.Router({mergeParams: true});
  const ctrl = authController(db);

  router.post("/login", ctrl.login);

  return router;
};
