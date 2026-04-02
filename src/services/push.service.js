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

        await admin.messaging().send(message);
        sent += 1;
      } catch (err) {
        failed += 1;

        const code = err?.errorInfo?.code || err?.code || "";

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
