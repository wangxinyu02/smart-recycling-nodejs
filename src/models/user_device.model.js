// src/models/user_device.model.js

const prisma = require("../config/prisma");

module.exports = {
  upsertDeviceToken: async ({ userId, fcmToken }) => {
    return prisma.$transaction(async (tx) => {
      const removedOtherUsers = await tx.userDevice.deleteMany({
        where: {
          fcm_token: fcmToken,
          user_id: { not: userId },
        },
      });

      const existing = await tx.userDevice.findFirst({
        where: {
          user_id: userId,
          fcm_token: fcmToken,
        },
      });

      if (existing) {
        const currentUserDuplicates = await tx.userDevice.deleteMany({
          where: {
            user_id: userId,
            fcm_token: fcmToken,
            id: { not: existing.id },
          },
        });

        const updated = await tx.userDevice.update({
          where: { id: existing.id },
          data: {
            user_id: userId,
          },
          select: { id: true, user_id: true, fcm_token: true, created_at: true },
        });

        console.log("[UserDevice] Reused FCM token for user", {
          device_id: updated.id,
          user_id: updated.user_id,
          removed_other_users: removedOtherUsers.count,
          removed_current_user_duplicates: currentUserDuplicates.count,
          token_suffix: String(updated.fcm_token || "").slice(-12),
        });

        return updated;
      }

      const created = await tx.userDevice.create({
        data: {
          user_id: userId,
          fcm_token: fcmToken,
        },
        select: { id: true, user_id: true, fcm_token: true, created_at: true },
      });

      console.log("[UserDevice] Stored new FCM token", {
        device_id: created.id,
        user_id: created.user_id,
        removed_other_users: removedOtherUsers.count,
        token_suffix: String(created.fcm_token || "").slice(-12),
      });

      return created;
    });
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

  deleteByUserIdAndToken: ({ userId, fcmToken }) => {
    return prisma.userDevice.deleteMany({
      where: {
        user_id: userId,
        fcm_token: fcmToken,
      },
    });
  },
};
