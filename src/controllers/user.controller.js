// src/controllers/user.controller.js

const userModel = require("../models/user.model");
const pointsTxnModel = require("../models/points_transaction.model");
const sessionModel = require("../models/recycling_session.model");
const itemModel = require("../models/recycling_item.model");
const rewardRedemptionModel = require("../models/reward_redemption.model");
const response = require("../utils/response.utils");
const prisma = require("../config/prisma");
const { buildParticipationMessage } = require("../utils/participation_rate.utils");
const { buildCo2ImpactMessage } = require("../utils/co2.utils");
const { toNum, round0, round1 } = require("../utils/number.utils");
const { startOfMonthUTC, addMonthsUTC } = require("../utils/date.utils");
const { capitalizeFirstLetter } = require("../utils/string.utils");

exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const role = req.query.role?.toLowerCase();

    if (role && !["admin", "user"].includes(role)) {
      return response.error(res, "Invalid role filter.", 400);
    }

    const result = await userModel.getAllUsers({
      page,
      limit,
      role,
    });

    return response.success(res, result, "Users fetched successfully", 200);
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

    const allTimeTotal = await itemModel.getAllTimeTotalsByUserId(userId);

    const totalPoints = await pointsTxnModel.getTotalPointsByUserId(userId);
    const breakdownPoints = await pointsTxnModel.getPointsSummaryByUserId(userId);
    const totalSessions = await sessionModel.countSessions({ user_id: userId });
    const averageWeightPerSession = await sessionModel.getAverageWeightPerSessionByUserId(userId);
    const rewardsSummary = await rewardRedemptionModel.getUserRedemptionSummary(userId);

    const topMaterial = await itemModel.getTopMaterial({
      user_id: userId,
    });

    const data = {
      user,
      summary: {
        total_weight_recycled: `${round1(allTimeTotal.totalWeight)}kg`,
        total_co2_emission_saved: `${round1(allTimeTotal.totalCo2)}kg`,
        total_sessions: null,
        points: `${totalPoints} pts`,
      },
      recycling_activity: {
        total_sessions: totalSessions,
        average_weight_per_session: `${averageWeightPerSession.average_weight_per_session}kg`,
        top_recycled_material: topMaterial ? capitalizeFirstLetter(topMaterial.material) : null,
      },
      points: {
        balance: `${totalPoints} pts`,
        earned: `${breakdownPoints.earned} pts`,
        spent: `${breakdownPoints.spent} pts`,
      },
      rewards: {
        redeemed: rewardsSummary.redeemed,
        used: rewardsSummary.used,
        unused: rewardsSummary.unused,
      },
    };

    return response.success(res, data, "User fetched successfully", 200);
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

    return response.success(res, deleted, "Account deleted successfully", 200);
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

    let trend = "";
    let percent = 0;

    if (lastMonthWeight === 0 && thisMonthWeight > 0) {
      trend = "↑";
      percent = 100; // “new activity” → show 100% (you can also choose 0 or null)
    } else if (lastMonthWeight > 0) {
      const change = ((thisMonthWeight - lastMonthWeight) / lastMonthWeight) * 100;
      percent = round0(Math.abs(change));
      if (change > 0) trend = "↑";
      else if (change < 0) trend = "↓";
      else trend = "";
    } else {
      trend = "";
      percent = 0;
    }

    // 3) Headline/description depends on participation rate
    const heroMessage = buildParticipationMessage(trend, percent);

    const data = {
      total_weight_recycled: {
        label: `${round1(totalWeight)}kg`, // e.g., 10.0
      },
      total_co2_emission_saved: {
        label: `${round1(totalCo2)}kg`, // e.g., 2.4
        message: buildCo2ImpactMessage(round1(totalCo2), userId).text,
      },
      participation_rate: {
        label: `${trend} ${percent}%`, // 50 means 50%
        message: "compared to last month",
      },
      encouragement: heroMessage,
    };

    return response.success(res, data, "Home data retrieved", 200);
  } catch (err) {
    console.error("getHome error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getAdminHome = async (req, res) => {
  try {
    const now = new Date();

    // UTC month boundaries
    const thisMonthStart = startOfMonthUTC(now);
    const nextMonthStart = addMonthsUTC(thisMonthStart, 1);
    const lastMonthStart = addMonthsUTC(thisMonthStart, -1);

    // 1) All-time totals
    const [
      totalsAgg,
      totalMerchants,
      totalUsers,
      thisMonthItemsAgg,
      lastMonthItemsAgg,
      thisMonthUsersCount,
      lastMonthUsersCount,
      thisMonthMerchantsCount,
      lastMonthMerchantsCount,
    ] = await Promise.all([
      prisma.recyclingItem.aggregate({
        where: {
          session: {
            ended_at: { not: null },
          },
        },
        _sum: {
          weight: true,
          co2_saved: true,
        },
      }),

      prisma.merchant.count(),

      prisma.user.count({
        where: {
          role: "user",
        },
      }),

      prisma.recyclingItem.aggregate({
        where: {
          session: {
            ended_at: { gte: thisMonthStart, lt: nextMonthStart },
          },
        },
        _sum: {
          weight: true,
          co2_saved: true,
        },
      }),

      prisma.recyclingItem.aggregate({
        where: {
          session: {
            ended_at: { gte: lastMonthStart, lt: thisMonthStart },
          },
        },
        _sum: {
          weight: true,
          co2_saved: true,
        },
      }),

      prisma.recyclingSession.findMany({
        where: {
          ended_at: { gte: thisMonthStart, lt: nextMonthStart },
          user_id: { not: null },
        },
        select: {
          user_id: true,
        },
        distinct: ["user_id"],
      }),

      prisma.recyclingSession.findMany({
        where: {
          ended_at: { gte: lastMonthStart, lt: thisMonthStart },
          user_id: { not: null },
        },
        select: {
          user_id: true,
        },
        distinct: ["user_id"],
      }),

      prisma.merchant.count({
        where: {
          created_at: { gte: thisMonthStart, lt: nextMonthStart },
        },
      }),

      prisma.merchant.count({
        where: {
          created_at: { gte: lastMonthStart, lt: thisMonthStart },
        },
      }),
    ]);

    const totalWeight = toNum(totalsAgg._sum.weight);
    const totalCo2 = toNum(totalsAgg._sum.co2_saved);

    const thisMonthWeight = toNum(thisMonthItemsAgg._sum.weight);
    const lastMonthWeight = toNum(lastMonthItemsAgg._sum.weight);

    const thisMonthCo2 = toNum(thisMonthItemsAgg._sum.co2_saved);
    const lastMonthCo2 = toNum(lastMonthItemsAgg._sum.co2_saved);

    const activeUsersThisMonth = thisMonthUsersCount.length;
    const activeUsersLastMonth = lastMonthUsersCount.length;

    const merchantsThisMonth = thisMonthMerchantsCount;
    const merchantsLastMonth = lastMonthMerchantsCount;

    const recycledTrend = buildTrend(thisMonthWeight, lastMonthWeight);
    const co2Trend = buildTrend(thisMonthCo2, lastMonthCo2);
    const usersTrend = buildTrend(activeUsersThisMonth, activeUsersLastMonth);
    const merchantsTrend = buildTrend(merchantsThisMonth, merchantsLastMonth);

    const data = {
      total_weight_recycled: {
        label: `${round1(totalWeight)}kg`,
        trend: recycledTrend.trend,
        percent: recycledTrend.percent,
        message: "vs last month",
      },
      total_co2_emission_saved: {
        label: `${round1(totalCo2)}kg`,
        trend: co2Trend.trend,
        percent: co2Trend.percent,
        message: "vs last month",
      },
      total_merchants: {
        label: `${totalMerchants}`,
        trend: merchantsTrend.trend,
        percent: merchantsTrend.percent,
        message: "new merchants vs last month",
      },
      total_users: {
        label: `${totalUsers}`,
        trend: usersTrend.trend,
        percent: usersTrend.percent,
        message: "active users vs last month",
      },
    };

    return response.success(res, data, "Admin home data retrieved", 200);
  } catch (err) {
    console.error("getAdminHome error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

function buildTrend(currentValue, previousValue) {
  let trend = "";
  let percent = 0;

  if (previousValue === 0 && currentValue > 0) {
    trend = "↑";
    percent = 100;
  } else if (previousValue > 0) {
    const change = ((currentValue - previousValue) / previousValue) * 100;
    percent = round0(Math.abs(change));

    if (change > 0) trend = "↑";
    else if (change < 0) trend = "↓";
  }

  return {
    trend,
    percent,
  };
}
