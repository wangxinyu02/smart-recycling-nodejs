// src/controllers/notification.controller.js

const notificationModel = require("../models/notification.model");
const response = require("../utils/response.utils");

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const type = req.query.type || undefined;
    const unreadOnly = String(req.query.unread_only).toLowerCase() === "true";

    const result = await notificationModel.getNotificationsByUserId({
      userId,
      page,
      limit,
      type,
      unreadOnly,
    });

    return response.success(res, result, "Notifications fetched successfully", 200);
  } catch (err) {
    console.error("getNotifications error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    const count = await notificationModel.getUnreadCountByUserId(userId);

    return response.success(res, { count }, "Unread notification count fetched successfully", 200);
  } catch (err) {
    console.error("getUnreadCount error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const notificationId = Number(req.params.id);

    if (!notificationId) {
      return response.error(res, "Invalid notification id", 400);
    }

    const notification = await notificationModel.getNotificationById(notificationId);

    if (!notification) {
      return response.error(res, "Notification not found", 404);
    }

    if (notification.user_id !== userId) {
      return response.error(res, "Forbidden", 403);
    }

    if (notification.read_at) {
      return response.success(res, notification, "Notification already marked as read", 200);
    }

    const updated = await notificationModel.markAsRead(notificationId);

    return response.success(res, updated, "Notification marked as read successfully", 200);
  } catch (err) {
    console.error("markNotificationAsRead error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await notificationModel.markAllAsReadByUserId(userId);

    return response.success(res, { updated_count: result.count }, "All notifications marked as read successfully", 200);
  } catch (err) {
    console.error("markAllNotificationsAsRead error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
