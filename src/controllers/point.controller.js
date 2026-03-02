// src/controllers/point.controller.js

const pointsTxnModel = require("../models/points_transaction.model");
const userModel = require("../models/user.model");
const response = require("../utils/response.utils");

exports.getUserTotalPoints = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userModel.getUserById(id);
    if (!user) return response.error(res, "User not found", 404);

    const total = await pointsTxnModel.getTotalPointsByUserId(id);
    
    return response.success(res, { total_points: total }, "Total points retrieved", 200);
  } catch (err) {
    console.error("getUserTotalPoints error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.listUserPointTransactions = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userModel.getUserById(id);
    if (!user) return response.error(res, "User not found", 404);

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const type = req.query.type ? String(req.query.type) : undefined;

    if (type && !["earn", "redeem", "adjust", "refund"].includes(type)) {
      return response.error(res, "Invalid type filter", 400);
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      pointsTxnModel.listByUserId({ user_id: id, skip, take: limit, type }),
      pointsTxnModel.countByUserId({ user_id: id, type }),
    ]);

    return response.success(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
      "Point transactions retrieved",
      200,
    );
  } catch (err) {
    console.error("listUserPointTransactions error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
