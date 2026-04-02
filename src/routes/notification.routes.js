// src/routes/notification.routes.js

const express = require("express");
const controller = require("../controllers/notification.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/notifications", authenticate, controller.getNotifications);
router.get("/notifications/unread-count", authenticate, controller.getUnreadCount);
router.patch("/notifications/read-all", authenticate, controller.markAllNotificationsAsRead);
router.patch("/notifications/:id/read", authenticate, controller.markNotificationAsRead);

module.exports = router;
