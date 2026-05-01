// src/routes/bin.routes.js

const express = require("express");
const binController = require("../controllers/bin.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/bins", authenticate, authorize("admin"), binController.createBin);
router.patch("/bins/:id", authenticate, authorize("admin"), binController.updateBin);
router.delete("/bins/:id", authenticate, authorize("admin"), binController.deleteBin);
router.get("/bins", authenticate, authorize("admin"), binController.listBins);
router.get("/bins/:id/logs", authenticate, authorize("admin"), binController.listBinLogs);
router.get("/bins/:id", authenticate, authorize("admin"), binController.getBinById);

module.exports = router;
