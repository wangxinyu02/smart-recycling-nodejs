// src/models/user_device.model.js

const prisma = require("../config/prisma");

module.exports = {
  upsertDeviceToken: async ({ userId, fcmToken }) => {
    const existing = await prisma.userDevice.findFirst({
      where: { fcm_token: fcmToken },
    });

    if (existing) {
      const updated = await prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          user_id: userId,
        },
        select: { id: true, user_id: true, fcm_token: true, created_at: true },
      });

      console.log("[UserDevice] Moved existing FCM token to user", {
        device_id: updated.id,
        previous_user_id: existing.user_id,
        user_id: updated.user_id,
        token_suffix: String(updated.fcm_token || "").slice(-12),
      });

      return updated;
    }

    const created = await prisma.userDevice.create({
      data: {
        user_id: userId,
        fcm_token: fcmToken,
      },
      select: { id: true, user_id: true, fcm_token: true, created_at: true },
    });

    console.log("[UserDevice] Stored new FCM token", {
      device_id: created.id,
      user_id: created.user_id,
      token_suffix: String(created.fcm_token || "").slice(-12),
    });

    return created;
  },

  getActiveTokensByUserId: async (userId) => {
    const rows = await prisma.userDevice.findMany({
      where: { user_id: userId },
      select: { id: true, fcm_token: true },
    });

    return rows;
  },

  deleteByIds: (ids) => {
    if (!ids?.length) return Promise.resolve({ count: 0 });
    return prisma.userDevice.deleteMany({
      where: { id: { in: ids } },
    });
  },

  deleteByToken: (fcmToken) => {
    return prisma.userDevice.deleteMany({
      where: { fcm_token: fcmToken },
    });
  },
};
