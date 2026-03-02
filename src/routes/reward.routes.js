// src/routes/reward.routes.js

const express = require("express");
const rewardController = require("../controllers/reward.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/rewards", authenticate, authorize("admin"), rewardController.createReward);
router.get("/rewards", rewardController.listRewards);
router.get("/rewards/:id", rewardController.getRewardById);
router.patch("/rewards/:id", authenticate, authorize("admin"), rewardController.updateReward);
router.delete("/rewards/:id", authenticate, authorize("admin"), rewardController.deleteReward);
router.patch("/rewards/:id/status", authenticate, authorize("admin"), rewardController.setRewardStatus);

module.exports = router;
