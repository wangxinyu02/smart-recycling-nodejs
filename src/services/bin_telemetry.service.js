const prisma = require("../config/prisma");
const { round2, toNumberOrNull } = require("../utils/number.utils");
const {
  createAdminBinAlertNotifications,
  evaluateBinAlerts,
  logBinAlertResets,
  sendBinAlertPushNotifications,
} = require("./bin_alert.service");

const DEFAULT_STATUS = "unknown";
const MAX_STATUS_LENGTH = 30;
const LOG_WEIGHT_CHANGE_THRESHOLD_KG = 0.01; // 0.01 kg
const LOG_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeStatus(status, currentWeight, maxWeight) {
  const rawStatus = firstDefined(status);

  if (rawStatus !== undefined) {
    const cleanStatus = String(rawStatus).trim().toLowerCase();
    return cleanStatus.slice(0, MAX_STATUS_LENGTH) || DEFAULT_STATUS;
  }

  if (maxWeight && maxWeight > 0) {
    const fillRatio = currentWeight / maxWeight;
    if (fillRatio >= 1) return "full";
    if (fillRatio >= 0.8) return "warning";
    return "normal";
  }

  return DEFAULT_STATUS;
}

function shouldCreateBinLog(lastLog, currentWeight, seenAt) {
  if (!lastLog) return true;

  const lastWeight = toNumberOrNull(lastLog.weight);
  if (lastWeight === null) return true;

  const weightChanged =
    Math.abs(currentWeight - lastWeight) > LOG_WEIGHT_CHANGE_THRESHOLD_KG;
  if (weightChanged) return true;

  const lastCreatedAt = lastLog.created_at ? new Date(lastLog.created_at) : null;
  if (!lastCreatedAt || Number.isNaN(lastCreatedAt.getTime())) return true;

  return seenAt.getTime() - lastCreatedAt.getTime() >= LOG_INTERVAL_MS;
}

function parseTelemetryPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const err = new Error("Telemetry payload must be a JSON object");
    err.statusCode = 400;
    throw err;
  }

  const binId = Number(firstDefined(payload.bin_id, payload.binId, payload.id));
  if (!Number.isInteger(binId) || binId <= 0) {
    const err = new Error("Telemetry payload requires a valid bin_id");
    err.statusCode = 400;
    throw err;
  }

  const rawCurrentWeight = firstDefined(payload.current_weight, payload.currentWeight, payload.weight, payload.weight_kg);
  const currentWeight = toNumberOrNull(rawCurrentWeight);
  if (currentWeight === null || currentWeight < 0) {
    const err = new Error("Telemetry payload requires a valid current_weight");
    err.statusCode = 400;
    throw err;
  }

  const rawTimestamp = firstDefined(payload.time, payload.timestamp, payload.last_seen_at, payload.lastSeenAt);
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const seenAt = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

  const roundedCurrentWeight = round2(currentWeight);

  return {
    binId,
    currentWeight: roundedCurrentWeight,
    status: payload.status,
    seenAt,
  };
}

async function recordBinTelemetry(payload) {
  const telemetry = parseTelemetryPayload(payload);

  const result = await prisma.$transaction(async (tx) => {
    let alertPushJobs = [];

    const existingBin = await tx.bin.findUnique({
      where: { id: telemetry.binId },
      select: {
        id: true,
        name: true,
        material: true,
        max_weight: true,
        half_alert_active: true,
        full_alert_active: true,
      },
    });

    if (!existingBin) {
      const err = new Error(`Bin not found: ${telemetry.binId}`);
      err.statusCode = 404;
      throw err;
    }

    const maxWeight = toNumberOrNull(existingBin.max_weight);
    const status = normalizeStatus(telemetry.status, telemetry.currentWeight, maxWeight);
    const alertResult = evaluateBinAlerts({
      bin: existingBin,
      currentWeight: telemetry.currentWeight,
      maxWeight,
    });

    const updatedBin = await tx.bin.update({
      where: { id: telemetry.binId },
      data: {
        current_weight: telemetry.currentWeight.toFixed(2),
        status,
        last_seen_at: telemetry.seenAt,
        ...alertResult.alertUpdates,
      },
      select: {
        id: true,
        name: true,
        material: true,
        max_weight: true,
        current_weight: true,
        status: true,
        last_seen_at: true,
        half_alert_active: true,
        full_alert_active: true,
      },
    });

    const alertNotificationResult = await createAdminBinAlertNotifications(tx, {
      binId: telemetry.binId,
      notifications: alertResult.notifications,
    });
    alertPushJobs = alertNotificationResult.pushJobs;

    logBinAlertResets(telemetry.binId, alertResult.resetLogs);

    const lastLog = await tx.binLog.findFirst({
      where: {
        bin_id: telemetry.binId,
      },
      select: {
        id: true,
        weight: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const shouldCreateLog = shouldCreateBinLog(
      lastLog,
      telemetry.currentWeight,
      telemetry.seenAt,
    );

    const log = shouldCreateLog
      ? await tx.binLog.create({
          data: {
            bin_id: telemetry.binId,
            weight: telemetry.currentWeight.toFixed(2),
            created_at: telemetry.seenAt,
          },
          select: {
            id: true,
            bin_id: true,
            weight: true,
            created_at: true,
          },
        })
      : null;

    return {
      bin: updatedBin,
      log,
      log_inserted: Boolean(log),
      log_reason: shouldCreateLog
        ? "weight_changed_or_interval_elapsed"
        : "skipped_no_significant_change",
      log_policy: {
        min_weight_change_kg: LOG_WEIGHT_CHANGE_THRESHOLD_KG,
        max_interval_minutes: LOG_INTERVAL_MS / 60000,
      },
      alert_notifications_created: alertNotificationResult.count,
      alert_push_jobs: alertPushJobs,
    };
  });

  const alertPushResult = await sendBinAlertPushNotifications(result.alert_push_jobs);

  return {
    ...result,
    alert_push_result: alertPushResult,
  };
}

module.exports = {
  parseTelemetryPayload,
  recordBinTelemetry,
  shouldCreateBinLog,
};
