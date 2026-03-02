// src/routes/auth.routes

const express = require("express");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.post("/auth/signup", authController.signup);
router.post("/auth/login", authController.login);
router.post("/auth/password/reset", authController.resetPassword);
router.get("/auth/check-email", authController.checkEmailAvailability);

module.exports = router;
