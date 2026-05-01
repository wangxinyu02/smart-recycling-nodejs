// src/services/push.service.js

const admin = require("../config/firebase.config");
const userDeviceModel = require("../models/user_device.model");

function buildFcmMessage({ token, title, body, data = {} }) {
  return {
    token,
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    android: {
      priority: "high",
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };
}

module.exports = {
  sendToUser: async ({ userId, title, body, data = {} }) => {
    const devices = await userDeviceModel.getActiveTokensByUserId(userId);

    console.log("[Push] User devices selected", {
      user_id: userId,
      token_count: devices.length,
      device_ids: devices.map((device) => device.id),
      token_suffixes: devices.map((device) => String(device.fcm_token || "").slice(-12)),
    });

    if (!devices.length) {
      return { sent: 0, failed: 0, removed_tokens: 0 };
    }

    let sent = 0;
    let failed = 0;
    const invalidDeviceIds = [];

    for (const device of devices) {
      try {
        const message = buildFcmMessage({
          token: device.fcm_token,
          title,
          body,
          data,
        });

        const response = await admin.messaging().send(message);
        sent += 1;
        console.log("[Push] Firebase send success", {
          user_id: userId,
          device_id: device.id,
          token_suffix: String(device.fcm_token || "").slice(-12),
          title,
          response,
        });
      } catch (err) {
        failed += 1;

        const code = err?.errorInfo?.code || err?.code || "";

        console.error("[Push] Firebase send failed", {
          user_id: userId,
          device_id: device.id,
          token_suffix: String(device.fcm_token || "").slice(-12),
          code,
          message: err.message,
        });

        if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
          invalidDeviceIds.push(device.id);
        }
      }
    }

    if (invalidDeviceIds.length) {
      await userDeviceModel.deleteByIds(invalidDeviceIds);
    }

    return {
      sent,
      failed,
      removed_tokens: invalidDeviceIds.length,
    };
  },
};
