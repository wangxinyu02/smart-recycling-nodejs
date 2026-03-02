// src/controllers/reward.controller.js
const rewardModel = require("../models/reward.model");
const merchantModel = require("../models/merchant.model"); // reuse your existing merchant model
const response = require("../utils/response.utils");

function toDateOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

exports.createReward = async (req, res) => {
  try {
    const {
      merchant_id,
      name,
      description,
      points_needed,
      max_redemptions,
      max_per_user,
      starts_at,
      expires_at,
    } = req.body;

    if (!merchant_id || !name || points_needed === undefined) {
      return response.error(res, "merchant_id, name and points_needed are required", 400);
    }

    const cleanName = String(name).trim();
    if (cleanName.length < 2) {
      return response.error(res, "Name is too short", 400);
    }

    const pts = Number(points_needed);
    if (!Number.isInteger(pts) || pts <= 0) {
      return response.error(res, "points_needed must be a positive integer", 400);
    }

    const mr = max_redemptions === undefined || max_redemptions === null ? null : Number(max_redemptions);
    const mp = max_per_user === undefined || max_per_user === null ? null : Number(max_per_user);

    if (mr !== null && (!Number.isInteger(mr) || mr <= 0)) {
      return response.error(res, "max_redemptions must be a positive integer", 400);
    }
    if (mp !== null && (!Number.isInteger(mp) || mp <= 0)) {
      return response.error(res, "max_per_user must be a positive integer", 400);
    }

    const startDate = toDateOrNull(starts_at);
    const endDate = toDateOrNull(expires_at);

    if (starts_at && !startDate) return response.error(res, "Invalid starts_at date", 400);
    if (expires_at && !endDate) return response.error(res, "Invalid expires_at date", 400);
    if (startDate && endDate && startDate > endDate) {
      return response.error(res, "starts_at cannot be later than expires_at", 400);
    }

    // ✅ validate merchant exists (and not soft-deleted)
    const merchant = await merchantModel.findActiveById(merchant_id);
    if (!merchant) {
      return response.error(res, "Merchant not found", 404);
    }

    const reward = await rewardModel.createReward({
      merchant_id: Number(merchant_id),
      name: cleanName,
      description: description ? String(description).trim() : null,
      points_needed: pts,
      max_redemptions: mr,
      max_per_user: mp,
      starts_at: startDate,
      expires_at: endDate,
      status: "active",
    });

    return response.success(res, reward, "Reward created", 201);
  } catch (err) {
    console.error("createReward error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getRewardById = async (req, res) => {
  try {
    const { id } = req.params;

    const reward = await rewardModel.findActiveById(id);
    if (!reward) {
      return response.error(res, "Reward not found", 404);
    }

    return response.success(res, reward, "Reward retrieved", 200);
  } catch (err) {
    console.error("getRewardById error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.listRewards = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const q = req.query.q ? String(req.query.q) : "";

    const merchant_id = req.query.merchant_id ? Number(req.query.merchant_id) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    if (status && !["active", "inactive"].includes(status)) {
      return response.error(res, "Invalid status filter", 400);
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      rewardModel.listRewards({ skip, take: limit, q, merchant_id, status }),
      rewardModel.countRewards({ q, merchant_id, status }),
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
      "Rewards retrieved",
      200
    );
  } catch (err) {
    console.error("listRewards error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.updateReward = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      merchant_id,
      name,
      description,
      points_needed,
      max_redemptions,
      max_per_user,
      starts_at,
      expires_at,
      status,
    } = req.body;

    const existing = await rewardModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Reward not found", 404);
    }

    const data = {};

    if (merchant_id !== undefined) {
      const merchant = await merchantModel.findActiveById(merchant_id);
      if (!merchant) return response.error(res, "Merchant not found", 404);
      data.merchant_id = Number(merchant_id);
    }

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (cleanName.length < 2) return response.error(res, "Name is too short", 400);
      data.name = cleanName;
    }

    if (description !== undefined) {
      data.description = description ? String(description).trim() : null;
    }

    if (points_needed !== undefined) {
      const pts = Number(points_needed);
      if (!Number.isInteger(pts) || pts <= 0) {
        return response.error(res, "points_needed must be a positive integer", 400);
      }
      data.points_needed = pts;
    }

    if (max_redemptions !== undefined) {
      const mr = max_redemptions === null ? null : Number(max_redemptions);
      if (mr !== null && (!Number.isInteger(mr) || mr <= 0)) {
        return response.error(res, "max_redemptions must be a positive integer", 400);
      }
      data.max_redemptions = mr;
    }

    if (max_per_user !== undefined) {
      const mp = max_per_user === null ? null : Number(max_per_user);
      if (mp !== null && (!Number.isInteger(mp) || mp <= 0)) {
        return response.error(res, "max_per_user must be a positive integer", 400);
      }
      data.max_per_user = mp;
    }

    if (starts_at !== undefined) {
      const startDate = toDateOrNull(starts_at);
      if (starts_at && !startDate) return response.error(res, "Invalid starts_at date", 400);
      data.starts_at = startDate;
    }

    if (expires_at !== undefined) {
      const endDate = toDateOrNull(expires_at);
      if (expires_at && !endDate) return response.error(res, "Invalid expires_at date", 400);
      data.expires_at = endDate;
    }

    // validate date range if either updated
    const newStarts = data.starts_at !== undefined ? data.starts_at : existing.starts_at;
    const newExpires = data.expires_at !== undefined ? data.expires_at : existing.expires_at;
    if (newStarts && newExpires && newStarts > newExpires) {
      return response.error(res, "starts_at cannot be later than expires_at", 400);
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(String(status))) {
        return response.error(res, "Invalid status", 400);
      }
      data.status = String(status);
    }

    if (Object.keys(data).length === 0) {
      return response.error(res, "No fields to update", 400);
    }

    const updated = await rewardModel.updateRewardById(id, data);
    return response.success(res, updated, "Reward updated", 200);
  } catch (err) {
    console.error("updateReward error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.deleteReward = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await rewardModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Reward not found", 404);
    }

    const deleted = await rewardModel.softDeleteRewardById(id);
    return response.success(res, deleted, "Reward deleted", 200);
  } catch (err) {
    console.error("deleteReward error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.setRewardStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["active", "inactive"].includes(String(status))) {
      return response.error(res, "status must be active or inactive", 400);
    }

    const existing = await rewardModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Reward not found", 404);
    }

    const updated = await rewardModel.updateRewardById(id, { status: String(status) });
    return response.success(res, updated, "Reward status updated", 200);
  } catch (err) {
    console.error("setRewardStatus error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};