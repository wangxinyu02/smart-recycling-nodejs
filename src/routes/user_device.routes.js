// src/routes/user_device.routes

const express = require("express");
const userDeviceController = require("../controllers/user_device.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/user-devices/register", authenticate, userDeviceController.registerDevice);
router.delete("/user-devices/token", authenticate, userDeviceController.removeDevice);

module.exports = router;
