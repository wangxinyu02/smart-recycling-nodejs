// src/services/push.service.js

const admin = require("../config/firebase.config");
const userDeviceModel = require("../models/user_device.model");
const notificationModel = require("../models/notification.model");

function buildFcmMessage({ token, title, body, data = {}, badgeCount = 0 }) {
  const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

  return {
    token,
    notification: {
      title,
      body,
    },
    data: {
      ...stringData,
      unread_count: String(badgeCount),
    },
    android: {
      priority: "high",
      notification: {
        notificationCount: Number(badgeCount) || 0,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: Number(badgeCount) || 0,
        },
      },
    },
  };
}

module.exports = {
  sendToUser: async ({ userId, title, body, data = {} }) => {
    const devices = await userDeviceModel.getActiveTokensByUserId(userId);
    const unreadCount = await notificationModel.getUnreadCountByUserId(userId);

    // console.log("[Push] User devices selected", {
    //   user_id: userId,
    //   token_count: devices.length,
    //   device_ids: devices.map((device) => device.id),
    //   token_suffixes: devices.map((device) => String(device.fcm_token || "").slice(-12)),
    // });

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
          badgeCount: unreadCount || 0,
        });

        const response = await admin.messaging().send(message);
        sent += 1;
        console.log("[Push] FCM message payload", JSON.stringify(message, null, 2));
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
