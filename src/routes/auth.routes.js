// src/routes/auth.routes

const express = require("express");
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/auth/signup", authController.signup);
router.post("/auth/login", authController.login);
router.post("/auth/password/reset", authController.resetPassword);
router.get("/auth/check-email", authController.checkEmailAvailability);
router.post("/auth/verify-password", authenticate, authController.verifyPassword);
module.exports = router;
