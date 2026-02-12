// src/controllers/user.controller.js

const userModel = require("../models/user.model");
const response = require("../utils/response.utils");

exports.getUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    return response.success(res, users, "Users fetched successfully", 200);
  } catch (err) {
    console.error("getUsers error:", err);
    return response.error(res, { error: err.message }, "Internal Server Error", 500);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.error(res, "Invalid user id", 400);
    }

    // Access control: user can only view self unless admin
    if (req.user?.role !== "admin" && req.user?.id !== userId) {
      return response.error(res, "Forbidden", 403);
    }

    const user = await userModel.getUserById(userId);

    if (!user) {
      return response.error(res, "User not found", 404);
    }

    return response.success(res, { user }, "User fetched successfully", 201);
  } catch (err) {
    console.error("getUserById Error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return response.error(res, "Invalid user id", 400);
    }

    // Access control: user can only update self unless admin
    if (req.user?.role !== "admin" && req.user?.id !== userId) {
      return response.error(res, "Forbidden", 403);
    }

    // Allowlist fields (VERY IMPORTANT)
    const allowedFields = ["name", "email"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // No updatable fields provided
    if (Object.keys(updateData).length === 0) {
      return response.error(res, "No valid fields to update", 400);
    }

    // Type checks + cleanup
    if (updateData.name !== undefined) {
      if (typeof updateData.name !== "string") {
        return response.error(res, "Name must be a string", 400);
      }
      updateData.name = updateData.name.trim();
      if (updateData.name.length === 0) updateData.name = null; // optional
    }
    console.log("helo");

    if (updateData.email !== undefined) {
      if (typeof updateData.email !== "string") {
        return response.error(res, "Email must be a string", 400);
      }
      updateData.email = updateData.email.toLowerCase().trim();
      if (!updateData.email.includes("@")) {
        return response.error(res, "Invalid email format", 400);
      }
    }

    // Update
    const updated = await userModel.updateUserById(userId, updateData);

    return response.success(res, updated, "User updated successfully", 200);
  } catch (err) {
    console.error("updateUser error:", err);

    // Prisma unique constraint (duplicate email) commonly throws error code P2002
    if (err.code === "P2002") {
      return response.error(res, "Email already registered", 409);
    }

    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
