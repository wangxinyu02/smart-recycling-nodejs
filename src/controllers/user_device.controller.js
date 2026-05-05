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

    const result = await userDeviceModel.deleteByToken(fcm_token);

    return response.success(res, null, "Device removed successfully", 200);
  } catch (err) {
    console.error("removeDevice error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
