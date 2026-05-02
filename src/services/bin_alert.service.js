const { buildNotification } = require("../config/notification.config");
const pushService = require("./push.service");

const HALF_FULL_RATIO = 0.5;
const ALMOST_FULL_RATIO = 0.9;
const ALERT_TYPE = "bin_alert";

function formatWeight(weight) {
  return Number(weight).toFixed(2);
}

function getBinName(bin) {
  if (bin.name && String(bin.name).trim()) {
    return String(bin.name).trim();
  }

  const material = bin.material ? String(bin.material) : "Smart";
  return `${material.charAt(0).toUpperCase()}${material.slice(1)} Bin`;
}

function buildBinAlertNotification({ variant, binName, currentWeight, maxWeight }) {
  return buildNotification(ALERT_TYPE, {
    variant,
    bin_name: binName,
    current_weight: formatWeight(currentWeight),
    max_weight: formatWeight(maxWeight),
  });
}

function evaluateBinAlerts({ bin, currentWeight, maxWeight }) {
  const alertUpdates = {};
  const notifications = [];
  const resetLogs = [];

  if (!maxWeight || maxWeight <= 0) {
    return { alertUpdates, notifications, resetLogs };
  }

  const binName = getBinName(bin);
  const isHalfFull = currentWeight >= maxWeight * HALF_FULL_RATIO;
  const isAlmostFull = currentWeight >= maxWeight * ALMOST_FULL_RATIO;

  if (isAlmostFull) {
    if (!bin.full_alert_active) {
      notifications.push({
        level: "full",
        ...buildBinAlertNotification({
          variant: "full",
          binName,
          currentWeight,
          maxWeight,
        }),
      });
      alertUpdates.full_alert_active = true;
    }

    if (!bin.half_alert_active) {
      alertUpdates.half_alert_active = true;
    }
  } else if (bin.full_alert_active) {
    alertUpdates.full_alert_active = false;
    resetLogs.push("full");
  }

  if (!isAlmostFull && isHalfFull) {
    if (!bin.half_alert_active) {
      notifications.push({
        level: "half",
        ...buildBinAlertNotification({
          variant: "half_full",
          binName,
          currentWeight,
          maxWeight,
        }),
      });
      alertUpdates.half_alert_active = true;
    }
  } else if (!isHalfFull && bin.half_alert_active) {
    alertUpdates.half_alert_active = false;
    resetLogs.push("half");
  }

  return { alertUpdates, notifications, resetLogs };
}

async function createAdminBinAlertNotifications(tx, { binId, notifications }) {
  if (!notifications.length) {
    return { count: 0, pushJobs: [] };
  }

  const admins = await tx.user.findMany({
    where: {
      role: "admin",
      status: "active",
      deleted_at: null,
    },
    select: { id: true },
  });

  console.log("[Bin Alert] Selected admin recipients", {
    bin_id: binId,
    admin_user_ids: admins.map((admin) => admin.id),
  });

  if (!admins.length) {
    console.log("[Bin Alert] No active admin users found for bin alert notifications", { bin_id: binId });
    return { count: 0, pushJobs: [] };
  }

  let createdCount = 0;
  const pushJobs = [];

  for (const notification of notifications) {
    const result = await tx.notification.createMany({
      data: admins.map((admin) => ({
        user_id: admin.id,
        title: notification.title,
        message: notification.message,
        type: ALERT_TYPE,
        reference_id: binId,
      })),
    });

    createdCount += result.count;

    for (const admin of admins) {
      pushJobs.push({
        userId: admin.id,
        title: notification.title,
        message: notification.message,
        type: ALERT_TYPE,
        referenceId: binId,
        data: {
          screen: "notifications",
          bin_id: binId,
          alert_level: notification.level,
        },
      });
    }

    console.log("[Bin Alert] Created notifications", {
      bin_id: binId,
      level: notification.level,
      admin_count: admins.length,
      title: notification.title,
    });
  }

  return { count: createdCount, pushJobs };
}

async function sendBinAlertPushNotifications(pushJobs = []) {
  if (!Array.isArray(pushJobs) || !pushJobs.length) {
    return { sent: 0, failed: 0, removed_tokens: 0 };
  }

  const total = {
    sent: 0,
    failed: 0,
    removed_tokens: 0,
  };

  for (const job of pushJobs) {
    console.log("[Bin Alert] Sending push notification", {
      user_id: job.userId,
      reference_id: job.referenceId,
      type: job.type,
      title: job.title,
    });

    const result = await pushService.sendToUser({
      userId: job.userId,
      title: job.title,
      body: job.message,
      data: {
        relatedType: job.type,
        relatedId: job.referenceId,
        type: job.type,
        reference_id: job.referenceId,
        ...job.data,
      },
    });

    total.sent += result.sent || 0;
    total.failed += result.failed || 0;
    total.removed_tokens += result.removed_tokens || 0;

    console.log("[Bin Alert] Push result", {
      user_id: job.userId,
      result,
    });
  }

  return total;
}

function logBinAlertResets(binId, resetLogs) {
  for (const level of resetLogs) {
    console.log("[Bin Alert] Reset alert state", {
      bin_id: binId,
      level,
    });
  }
}

module.exports = {
  evaluateBinAlerts,
  createAdminBinAlertNotifications,
  sendBinAlertPushNotifications,
  logBinAlertResets,
};
