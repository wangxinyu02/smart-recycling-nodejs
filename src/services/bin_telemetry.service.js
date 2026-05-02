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

function normalizeMacAddress(macAddress) {
  return String(macAddress).trim().toUpperCase();
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

  const rawMacAddress = firstDefined(payload.mac_address, payload.macAddress, payload.mac);
  const macAddress = rawMacAddress === undefined ? "" : normalizeMacAddress(rawMacAddress);

  if (!macAddress) {
    const err = new Error("Telemetry payload requires a valid mac_address");
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
    macAddress,
    currentWeight: roundedCurrentWeight,
    status: payload.status,
    seenAt,
  };
}

async function findOrCreateDeviceByMacAddress(macAddress) {
  const selectDeviceForTelemetry = {
    id: true,
    name: true,
    type: true,
    mac_address: true,
    deleted_at: true,
  };

  const activeDevices = await prisma.device.findMany({
    where: {
      mac_address: macAddress,
      deleted_at: null,
    },
    select: selectDeviceForTelemetry,
    orderBy: {
      id: "asc",
    },
  });

  if (activeDevices.length > 1) {
    const err = new Error(`Multiple active devices found for mac_address: ${macAddress}`);
    err.statusCode = 409;
    throw err;
  }

  if (activeDevices.length === 1) {
    return {
      device: activeDevices[0],
      created: false,
    };
  }

  const created = await prisma.device.create({
    data: {
      mac_address: macAddress,
    },
    select: selectDeviceForTelemetry,
  });

  const activeDevicesAfterCreate = await prisma.device.findMany({
    where: {
      mac_address: macAddress,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (activeDevicesAfterCreate.length > 1) {
    const err = new Error(`Multiple active devices found for mac_address: ${macAddress}`);
    err.statusCode = 409;
    throw err;
  }

  return {
    device: created,
    created: true,
  };
}

async function recordBinTelemetry(payload) {
  const telemetry = parseTelemetryPayload(payload);
  const { device, created: deviceCreated } = await findOrCreateDeviceByMacAddress(telemetry.macAddress);

  if (!device) {
    const err = new Error(`Device not found: ${telemetry.macAddress}`);
    err.statusCode = 404;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    let alertPushJobs = [];

    const activeDeviceMap = await tx.binDeviceMap.findFirst({
      where: {
        device_id: device.id,
        deleted_at: null,
        bin: {
          deleted_at: null,
        },
      },
      select: {
        id: true,
        bin_id: true,
        bin: {
          select: {
            id: true,
            name: true,
            material: true,
            max_weight: true,
            half_alert_active: true,
            full_alert_active: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!activeDeviceMap?.bin) {
      const err = new Error(`Device is not assigned to a bin: ${telemetry.macAddress}`);
      err.statusCode = 400;
      throw err;
    }

    const binId = activeDeviceMap.bin_id;
    const existingBin = activeDeviceMap.bin;

    const maxWeight = toNumberOrNull(existingBin.max_weight);
    const status = normalizeStatus(telemetry.status, telemetry.currentWeight, maxWeight);
    const alertResult = evaluateBinAlerts({
      bin: existingBin,
      currentWeight: telemetry.currentWeight,
      maxWeight,
    });

    const updatedBin = await tx.bin.update({
      where: { id: binId },
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
      binId,
      notifications: alertResult.notifications,
    });
    alertPushJobs = alertNotificationResult.pushJobs;

    logBinAlertResets(binId, alertResult.resetLogs);

    const lastLog = await tx.binLog.findFirst({
      where: {
        bin_id: binId,
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
            bin_id: binId,
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
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        mac_address: device.mac_address,
      },
      device_created: deviceCreated,
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
