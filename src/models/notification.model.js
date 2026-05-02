// src/models/notification.model.js

const prisma = require("../config/prisma");

const selectNotification = {
  id: true,
  user_id: true,
  title: true,
  message: true,
  type: true,
  reference_id: true,
  read_at: true,
  created_at: true,
};

module.exports = {
  // Get notifications with pagination
  getNotificationsByUserId: ({ userId, page = 1, limit = 10, type, unreadOnly = false }) => {
    const skip = (page - 1) * limit;

    const where = {
      user_id: userId,
      ...(type ? { type } : {}),
      ...(unreadOnly ? { read_at: null } : {}),
    };

    return Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        select: selectNotification,
      }),
      prisma.notification.count({ where }),
    ]).then(([items, total]) => ({
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    }));
  },

  // Get unread count
  getUnreadCountByUserId: (userId) => {
    return prisma.notification.count({
      where: {
        user_id: userId,
        read_at: null,
      },
    });
  },

  // Find one notification
  getNotificationById: (id) => {
    return prisma.notification.findUnique({
      where: { id: Number(id) },
      select: selectNotification,
    });
  },

  // Mark one as read
  markAsRead: (id) => {
    return prisma.notification.update({
      where: { id: Number(id) },
      data: {
        read_at: new Date(),
      },
      select: {
        id: true,
        type: true,
        reference_id: true,
        read_at: true,
      },
    });
  },

  // Mark all as read
  markAllAsReadByUserId: (userId) => {
    return prisma.notification.updateMany({
      where: {
        user_id: userId,
        read_at: null,
      },
      data: {
        read_at: new Date(),
      },
    });
  },

  // Create one notification
  createNotification: ({ user_id, title, message, type, reference_id = null }) => {
    return prisma.notification.create({
      data: {
        user_id,
        title,
        message,
        type,
        reference_id,
      },
      select: selectNotification,
    });
  },

  // Create many notifications (for admin / broadcast)
  createNotificationsForUsers: ({ userIds, title, message, type, reference_id = null }) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return Promise.resolve({ count: 0 });
    }

    return prisma.notification.createMany({
      data: userIds.map((userId) => ({
        user_id: userId,
        title,
        message,
        type,
        reference_id,
      })),
    });
  },
};
