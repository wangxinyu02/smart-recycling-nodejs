// src/controllers/user_device.controller.js

const userDeviceModel = require("../models/user_device.model");
const response = require("../utils/response.utils");

exports.registerDevice = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return response.error(res, "FCM token is required", 400);
    }

    console.log("[UserDevice] Register request", {
      user_id: userId,
      role: req.user?.role,
      token_suffix: String(fcm_token || "").slice(-12),
    });

    const device = await userDeviceModel.upsertDeviceToken({
      userId,
      fcmToken: fcm_token,
    });

    return response.success(res, device, "Device registered successfully", 200);
  } catch (err) {
    console.error("registerDevice error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.removeDevice = async (req, res) => {
  try {
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return response.error(res, "FCM token is required", 400);
    }

    console.log("[UserDevice] Remove request", {
      user_id: req.user?.id,
      role: req.user?.role,
      token_suffix: String(fcm_token || "").slice(-12),
    });

    const result = await userDeviceModel.deleteByToken(fcm_token);
    console.log("[UserDevice] Remove result", {
      user_id: req.user?.id,
      removed_count: result.count,
    });

    return response.success(res, null, "Device removed successfully", 200);
  } catch (err) {
    console.error("removeDevice error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
