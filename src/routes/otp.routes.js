// src/routes/otp.routes

const express = require("express");
const otpController = require("../controllers/otp.controller");

const router = express.Router();

router.post("/auth/otp/send", otpController.sendOtp);
router.post("/auth/otp/verify", otpController.verifyOtp);

module.exports = router;
