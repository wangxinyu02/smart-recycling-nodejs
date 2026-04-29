const prisma = require("../config/prisma");
const { round2, toNumberOrNull } = require("../utils/number.utils");

const DEFAULT_STATUS = "unknown";
const MAX_STATUS_LENGTH = 30;

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

  return prisma.$transaction(async (tx) => {
    const existingBin = await tx.bin.findUnique({
      where: { id: telemetry.binId },
      select: {
        id: true,
        max_weight: true,
      },
    });

    if (!existingBin) {
      const err = new Error(`Bin not found: ${telemetry.binId}`);
      err.statusCode = 404;
      throw err;
    }

    const maxWeight = toNumberOrNull(existingBin.max_weight);
    const status = normalizeStatus(telemetry.status, telemetry.currentWeight, maxWeight);

    const updatedBin = await tx.bin.update({
      where: { id: telemetry.binId },
      data: {
        current_weight: telemetry.currentWeight.toFixed(2),
        status,
        last_seen_at: telemetry.seenAt,
      },
      select: {
        id: true,
        name: true,
        material: true,
        max_weight: true,
        current_weight: true,
        status: true,
        last_seen_at: true,
      },
    });

    const log = await tx.binLog.create({
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
    });

    return { bin: updatedBin, log };
  });
}

module.exports = {
  parseTelemetryPayload,
  recordBinTelemetry,
};
