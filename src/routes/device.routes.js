// src/routes/device.routes.js

const express = require("express");
const deviceController = require("../controllers/device.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/devices", authenticate, authorize("admin"), deviceController.createDevice);
router.get("/devices", authenticate, authorize("admin"), deviceController.listDevices);
router.get("/devices/:id", authenticate, authorize("admin"), deviceController.getDeviceById);
router.patch("/devices/:id", authenticate, authorize("admin"), deviceController.updateDevice);
router.delete("/devices/:id", authenticate, authorize("admin"), deviceController.deleteDevice);

module.exports = router;
