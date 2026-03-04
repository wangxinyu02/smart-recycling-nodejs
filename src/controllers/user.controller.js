// src/controllers/user.controller.js

const userModel = require("../models/user.model");
const response = require("../utils/response.utils");
const prisma = require("../config/prisma");
const { buildParticipationMessage } = require("../utils/participation_rate.utils");
const { buildCo2ImpactMessage } = require("../utils/co2.utils");
const { toNum, round0, round1 } = require("../utils/number.utils");
const { startOfMonthUTC, addMonthsUTC } = require("../utils/date.utils");

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

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return response.error(res, "Invalid user id", 400);
    }

    // Access control: user can only delete self unless admin
    if (req.user?.role !== "admin" && req.user?.id !== userId) {
      return response.error(res, "Forbidden", 403);
    }

    const user = await userModel.getExistingUserById(userId);

    if (!user) {
      return response.error(res, "User not found", 404);
    }

    const deleted = await userModel.deleteUserById(userId);

    return response.success(res, deleted, "User deleted successfully", 200);
  } catch (err) {
    console.error("deleteUser error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getHome = async (req, res) => {
  try {
    const userId = req.user?.id;

    // Time windows (UTC month boundaries)
    const now = new Date();
    const thisMonthStart = startOfMonthUTC(now);
    const nextMonthStart = addMonthsUTC(thisMonthStart, 1);
    const lastMonthStart = addMonthsUTC(thisMonthStart, -1);

    // 1) All-time totals (only count ended sessions via relation filter)
    const totalsAgg = await prisma.recyclingItem.aggregate({
      where: {
        session: {
          user_id: userId,
          ended_at: { not: null },
        },
      },
      _sum: {
        weight: true,
        co2_saved: true,
      },
    });

    const totalWeight = toNum(totalsAgg._sum.weight);
    const totalCo2 = toNum(totalsAgg._sum.co2_saved);

    // 2) Month-over-month participation (use total recycled weight as “participation”)
    const [thisMonthAgg, lastMonthAgg] = await Promise.all([
      prisma.recyclingItem.aggregate({
        where: {
          session: {
            user_id: userId,
            ended_at: { gte: thisMonthStart, lt: nextMonthStart },
          },
        },
        _sum: { weight: true },
      }),
      prisma.recyclingItem.aggregate({
        where: {
          session: {
            user_id: userId,
            ended_at: { gte: lastMonthStart, lt: thisMonthStart },
          },
        },
        _sum: { weight: true },
      }),
    ]);

    const thisMonthWeight = toNum(thisMonthAgg._sum.weight);
    const lastMonthWeight = toNum(lastMonthAgg._sum.weight);

    let trend = "neutral";
    let percent = 0;

    if (lastMonthWeight === 0 && thisMonthWeight > 0) {
      trend = "up";
      percent = 100; // “new activity” → show 100% (you can also choose 0 or null)
    } else if (lastMonthWeight > 0) {
      const change = ((thisMonthWeight - lastMonthWeight) / lastMonthWeight) * 100;
      percent = round0(Math.abs(change));
      if (change > 0) trend = "up";
      else if (change < 0) trend = "down";
      else trend = "neutral";
    } else {
      trend = "neutral";
      percent = 0;
    }

    // 3) CO2 equivalency message

    // 4) Headline/description depends on participation rate
    const heroMessage = buildParticipationMessage(trend, percent);

    const data = {
      total_weight_recycled: {
        number: `${round1(totalWeight)}kg`, // e.g., 10.0
      },
      total_co2_emission_saved: {
        number: `${round1(totalCo2)}kg CO₂`, // e.g., 2.4
        message: buildCo2ImpactMessage(round1(totalCo2), userId).text,
      },
      participation_rate: {
        trend, // "up" | "down" | "neutral"
        number: percent, // 50 means 50%
        message: "compared to last month",
      },
      message: heroMessage,
    };

    return response.success(res, data, "Home data retrieved", 200);
  } catch (err) {
    console.error("getHome error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
