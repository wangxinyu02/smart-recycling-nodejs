// src/controllers/bin.controller.js

const binModel = require("../models/bin.model");
const response = require("../utils/response.utils");
const { MATERIALS } = require("../config/material.config");
const { toNumberOrNull } = require("../utils/number.utils");

function parseMaxWeight(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const maxWeight = toNumberOrNull(value);
  if (maxWeight === null || maxWeight <= 0) {
    const err = new Error("max_weight must be greater than 0");
    err.statusCode = 400;
    throw err;
  }

  return maxWeight.toFixed(2);
}

function parseNullableText(value, fieldName, maxLength) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    const err = new Error(`${fieldName} must be a string`);
    err.statusCode = 400;
    throw err;
  }

  const cleanValue = value.trim();
  if (cleanValue.length === 0) return null;
  if (cleanValue.length > maxLength) {
    const err = new Error(`${fieldName} is too long (max ${maxLength})`);
    err.statusCode = 400;
    throw err;
  }

  return cleanValue;
}

async function parseDeviceId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const deviceId = Number(value);
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    const err = new Error("Invalid device id");
    err.statusCode = 400;
    throw err;
  }

  const device = await binModel.findActiveDeviceById(deviceId);
  if (!device) {
    const err = new Error("Device not found");
    err.statusCode = 404;
    throw err;
  }

  return deviceId;
}

function parseLogRange(value) {
  const range = value ? String(value) : "today";
  const now = new Date();

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { range, created_at_gte: start };
  }

  if (range === "7_days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { range, created_at_gte: start };
  }

  const err = new Error("Invalid range. Allowed: today, 7_days");
  err.statusCode = 400;
  throw err;
}

exports.createBin = async (req, res) => {
  try {
    const { name, material, max_weight, location, device_id } = req.body;

    if (!material) return response.error(res, "material is required", 400);
    if (!MATERIALS.includes(String(material))) {
      return response.error(res, `Invalid material. Allowed: ${MATERIALS.join(", ")}`, 400);
    }

    const cleanName = parseNullableText(name, "name", 120) ?? null;
    const cleanLocation = parseNullableText(location, "location", 150) ?? null;
    const deviceId = await parseDeviceId(device_id);

    const created = await binModel.createBin({
      name: cleanName,
      material: String(material),
      location: cleanLocation,
      max_weight: parseMaxWeight(max_weight),
      ...(deviceId !== undefined ? { device_id: deviceId } : {}),
    });

    return response.success(res, created, "Bin created successfully", 201);
  } catch (err) {
    console.error("createBin error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

exports.getBinById = async (req, res) => {
  try {
    const { id } = req.params;
    const binId = Number(id);

    if (!Number.isInteger(binId) || binId <= 0) {
      return response.error(res, "Invalid bin id", 400);
    }

    const bin = await binModel.getBinById(binId);
    if (!bin) return response.error(res, "Bin not found", 404);

    return response.success(res, bin, "Bin fetched successfully", 200);
  } catch (err) {
    console.error("getBinById error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.listBins = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const q = req.query.q ? String(req.query.q) : "";
    const material = req.query.material ? String(req.query.material) : undefined;

    if (material && !MATERIALS.includes(material)) {
      return response.error(res, `Invalid material filter. Allowed: ${MATERIALS.join(", ")}`, 400);
    }

    const [items, total] = await Promise.all([binModel.listBins({ skip, take: limit, q, material }), binModel.countBins({ q, material })]);

    return response.success(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
      "Bins retrieved",
      200,
    );
  } catch (err) {
    console.error("listBins error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.updateBin = async (req, res) => {
  try {
    const { id } = req.params;
    const binId = Number(id);

    if (!Number.isInteger(binId) || binId <= 0) {
      return response.error(res, "Invalid bin id", 400);
    }

    const existing = await binModel.getBinById(binId);
    if (!existing) return response.error(res, "Bin not found", 404);

    const { name, material, max_weight, location, device_id } = req.body;
    const data = {};

    if (name !== undefined) {
      data.name = parseNullableText(name, "name", 120);
    }

    if (material !== undefined) {
      if (!MATERIALS.includes(String(material))) {
        return response.error(res, `Invalid material. Allowed: ${MATERIALS.join(", ")}`, 400);
      }
      data.material = String(material);
    }

    if (max_weight !== undefined) {
      data.max_weight = parseMaxWeight(max_weight);
    }

    if (location !== undefined) {
      data.location = parseNullableText(location, "location", 150);
    }

    if (device_id !== undefined) {
      data.device_id = await parseDeviceId(device_id);
    }

    if (Object.keys(data).length === 0) {
      return response.error(res, "No fields to update", 400);
    }

    const updated = await binModel.updateBinById(binId, data);
    return response.success(res, updated, "Bin updated successfully", 200);
  } catch (err) {
    console.error("updateBin error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

exports.deleteBin = async (req, res) => {
  try {
    const { id } = req.params;
    const binId = Number(id);

    if (!Number.isInteger(binId) || binId <= 0) {
      return response.error(res, "Invalid bin id", 400);
    }

    const existing = await binModel.getBinById(binId);
    if (!existing) return response.error(res, "Bin not found", 404);

    const deleted = await binModel.deleteBinById(binId);
    return response.success(res, deleted, "Bin deleted successfully", 200);
  } catch (err) {
    console.error("deleteBin error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

exports.listBinLogs = async (req, res) => {
  try {
    const binId = Number(req.params.id);
    if (!Number.isInteger(binId) || binId <= 0) {
      return response.error(res, "Invalid bin id", 400);
    }

    const existing = await binModel.getBinById(binId);
    if (!existing) return response.error(res, "Bin not found", 404);

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
    const skip = (page - 1) * limit;
    const { range, created_at_gte } = parseLogRange(req.query.range);

    const [items, total] = await Promise.all([
      binModel.listBinLogs({ bin_id: binId, skip, take: limit, created_at_gte }),
      binModel.countBinLogs({ bin_id: binId, created_at_gte }),
    ]);

    return response.success(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        filter: {
          range,
        },
      },
      "Bin logs retrieved",
      200,
    );
  } catch (err) {
    console.error("listBinLogs error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};
