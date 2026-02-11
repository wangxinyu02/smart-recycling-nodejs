const bcrypt = require("bcrypt");
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

    return response.success(res, {userId: user.id}, "User created successfully", 201);
  } catch (err) {
    console.error("Signup Error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
