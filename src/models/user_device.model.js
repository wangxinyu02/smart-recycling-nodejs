// src/models/user_device.model.js

const prisma = require("../config/prisma");

module.exports = {
  upsertDeviceToken: async ({ userId, fcmToken }) => {
    const existing = await prisma.userDevice.findFirst({
      where: { fcm_token: fcmToken },
    });

    if (existing) {
      return prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          user_id: userId,
        },
      });
    }

    return prisma.userDevice.create({
      data: {
        user_id: userId,
        fcm_token: fcmToken,
      },
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
};