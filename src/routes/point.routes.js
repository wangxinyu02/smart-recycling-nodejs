// src/routes/point.routes.js

const express = require("express");
const pointsController = require("../controllers/point.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/users/:id/points", authenticate, authorize("user"), pointsController.getUserTotalPoints);
router.get("/users/:id/points/transactions", authenticate, pointsController.listUserPointTransactions);

module.exports = router;
