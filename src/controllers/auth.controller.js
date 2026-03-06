// src/controllers/auth.controller.js

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const response = require("../utils/response.utils");

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ✅ Basic validation
    if (!email || !password) {
      return response.error(res, "Email and password are required", 400);
    }
    if (typeof email !== "string" || typeof password !== "string") {
      return response.error(res, "Invalid input types", 400);
    }
    if (password.length < 8) {
      return response.error(res, "Password must be at least 8 characters", 400);
    }

    // ✅ Check duplicates
    const existing = await userModel.findByEmail(email.toLowerCase());
    if (existing) {
      return response.error(res, "Email already registered", 409);
    }

    // ✅ Hash password
    const hashed = await bcrypt.hash(password, 10);

    // ✅ Create user
    const user = await userModel.createUser({
      name: name?.trim() || null,
      email: email.toLowerCase().trim(),
      password_hash: hashed,
      role: "user",
    });

    return response.success(res, { id: user.id }, "User created successfully", 201);
  } catch (err) {
    console.error("Signup Error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Validate
    if (!email || !password) {
      return response.error(res, "Email and password are required", 400);
    }
    if (typeof email !== "string" || typeof password !== "string") {
      return response.error(res, "Invalid input types", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ Find user (include password hash for compare)
    const user = await userModel.findForLoginByEmail(normalizedEmail);
    if (!user) {
      // Do NOT reveal whether email exists
      return response.error(res, "Invalid email or password", 400);
    }

    if (user.deleted_at) {
      return response.error(res, "User not found", 404);
    }

    // ✅ Compare password
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return response.error(res, "Invalid email or password", 400);
    }

    const claims = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // ✅ Create JWT
    const token = jwt.sign(claims, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    return response.success(res, { token, user: { ...claims } }, "Login successful", 200);
  } catch (err) {
    console.error("Login Error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return response.error(res, "Email and password are required", 400);
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (typeof password !== "string" || password.length < 8) {
      return response.error(res, "Password must be at least 8 characters", 400);
    }

    const user = await userModel.getExistingUserByEmail(normalizedEmail);
    if (!user) {
      return response.error(res, "User not found", 404);
    }

    const hashed = await bcrypt.hash(password, 10);

    await userModel.updatePasswordByEmail(normalizedEmail, hashed);

    return response.success(res, null, "Password reset successful", 200);
  } catch (err) {
    console.error("resetPassword error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return response.error(res, "Email is required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await userModel.getExistingUserByEmail(normalizedEmail);

    return response.success(res, { available: !existing }, "Email check completed", 200);
  } catch (err) {
    console.error("checkEmailAvailability error:", err);
    return response.error(res, "Internal Server Error", 500);
  }
};

exports.verifyPassword = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return response.error(res, "Unauthorized", 401);
    }

    const { password } = req.body;

    if (!password) {
      return response.error(res, "Password is required", 400);
    }

    const user = await userModel.getUserPasswordById(userId);

    if (!user) {
      return response.error(res, "User not found", 404);
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return response.error(res, "Incorrect password", 401);
    }

    return response.success(res, null, "Password verified", 200);
  } catch (err) {
    console.error("verifyPassword error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return response.error(res, "Unauthorized", 401);
    }
    const { password } = req.body;

    if (!password) {
      return response.error(res, "Password is required", 400);
    }

    const hashed = await bcrypt.hash(password, 10);

    await userModel.updatePasswordById(userId, hashed);

    return response.success(res, null, "Password changed successful", 200);
  } catch (err) {
    console.error("changePassword error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
