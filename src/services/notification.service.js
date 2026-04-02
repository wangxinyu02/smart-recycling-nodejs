// src/services/notification.service.js

const notificationModel = require("../models/notification.model");
const pushService = require("./push.service");

module.exports = {
  notifyUser: async ({ userId, title, message, type, referenceId = null, data = {} }) => {
    const dbNotification = await notificationModel.createNotification({
      user_id: userId,
      title,
      message,
      type,
      reference_id: referenceId,
    });

    const pushResult = await pushService.sendToUser({
      userId,
      title,
      body: message,
      data: {
        notification_id: dbNotification.id,
        type,
        reference_id: referenceId ?? "",
        ...data,
      },
    });

    return {
      notification: dbNotification,
      push: pushResult,
    };
  },

  notifyUsers: async ({ userIds, title, message, type, referenceId = null, data = {} }) => {
    if (!Array.isArray(userIds) || !userIds.length) {
      return { count: 0 };
    }

    await notificationModel.createNotificationsForUsers({
      userIds,
      title,
      message,
      type,
      reference_id: referenceId,
    });

    const results = [];
    for (const userId of userIds) {
      const push = await pushService.sendToUser({
        userId,
        title,
        body: message,
        data: {
          type,
          reference_id: referenceId ?? "",
          ...data,
        },
      });
      results.push({ userId, push });
    }

    return {
      count: userIds.length,
      results,
    };
  },
};