// src/routes/recycling_session.routes.js
const express = require("express");
const sessionController = require("../controllers/recycling.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/recycling-sessions", sessionController.createSession);
router.post("/recycling-sessions/start", sessionController.startSession); // NEW
router.get("/recycling-sessions", authenticate, sessionController.listSessions);
router.get("/recycling-sessions/top-material", authenticate, sessionController.getTopRecycledMaterial);
router.get("/recycling-sessions/weight-over-time", authenticate, sessionController.getRecyclableWeightOverTime);
router.get("/recycling-sessions/bin-status/:bin_id", sessionController.getBinStatus);
router.get("/recycling-sessions/:id/live-weight", sessionController.getSessionLiveWeight);
router.get("/recycling-sessions/:id", authenticate, sessionController.getSessionById);
router.post("/recycling-sessions/:id/end", sessionController.endSession); // NEW
router.patch("/recycling-sessions/:id/end", sessionController.endSession);
router.post("/recycling-sessions/claim", authenticate, authorize("user"), sessionController.claimSession);

module.exports = router;

