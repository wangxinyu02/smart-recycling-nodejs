// src/routes/recycling_session.routes.js
const express = require("express");
const sessionController = require("../controllers/recycling.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/recycling-sessions", sessionController.createSession);
router.get("/recycling-sessions", authenticate, sessionController.listSessions);
router.get("/recycling-sessions/top-material", authenticate, sessionController.getTopRecycledMaterial);
router.get("/recycling-sessions/weight-over-time", authenticate, sessionController.getRecyclableWeightOverTime);
router.get("/recycling-sessions/:id", authenticate, sessionController.getSessionById);
router.patch("/recycling-sessions/:id/end", sessionController.endSession);
router.post("/recycling-sessions/claim", authenticate, authorize("user"), sessionController.claimSession);

module.exports = router;
