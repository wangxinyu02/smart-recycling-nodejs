// src/controllers/device.controller.js

const deviceModel = require("../models/device.model");
const response = require("../utils/response.utils");

const DEVICE_TYPES = ["esp32", "other"];

function normalizeMacAddress(macAddress) {
  return String(macAddress).trim().toUpperCase();
}

function normalizeName(name) {
  if (name === null) return null;
  const cleanName = String(name).trim();
  return cleanName.length === 0 ? null : cleanName;
}

function isValidId(id) {
  const parsedId = Number(id);
  return Number.isInteger(parsedId) && parsedId > 0;
}

function isPrismaUniqueConstraintError(err) {
  return err && err.code === "P2002";
}

exports.createDevice = async (req, res) => {
  try {
    const { name, type, mac_address } = req.body;

    if (mac_address === undefined || mac_address === null) {
      return response.error(res, "mac_address is required", 400);
    }

    const cleanMacAddress = normalizeMacAddress(mac_address);
    if (!cleanMacAddress) {
      return response.error(res, "mac_address cannot be empty", 400);
    }

    const existing = await deviceModel.findActiveByMacAddress(cleanMacAddress);
    if (existing) {
      return response.error(res, "Device mac_address already exists", 409);
    }

    const data = {
      mac_address: cleanMacAddress,
    };

    if (name !== undefined) {
      data.name = normalizeName(name);
    }

    if (type !== undefined) {
      if (!DEVICE_TYPES.includes(String(type))) {
        return response.error(res, `Invalid type. Allowed: ${DEVICE_TYPES.join(", ")}`, 400);
      }
      data.type = String(type);
    }

    const device = await deviceModel.createDevice(data);
    return response.success(res, device, "Device created", 201);
  } catch (err) {
    console.error("createDevice error:", err);
    if (isPrismaUniqueConstraintError(err)) {
      return response.error(res, "Device mac_address already exists", 409);
    }
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return response.error(res, "Invalid device id", 400);
    }

    const device = await deviceModel.findActiveById(id);
    if (!device) {
      return response.error(res, "Device not found", 404);
    }

    return response.success(res, device, "Device retrieved", 200);
  } catch (err) {
    console.error("getDeviceById error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.listDevices = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const q = req.query.q ? String(req.query.q) : "";
    const availableForBinId = req.query.available_for_bin_id ? Number(req.query.available_for_bin_id) : undefined;

    if (availableForBinId !== undefined && (!Number.isInteger(availableForBinId) || availableForBinId <= 0)) {
      return response.error(res, "Invalid bin id", 400);
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      deviceModel.listDevices({ skip, take: limit, q, available_for_bin_id: availableForBinId }),
      deviceModel.countDevices({ q, available_for_bin_id: availableForBinId }),
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
      },
      "Devices retrieved",
      200,
    );
  } catch (err) {
    console.error("listDevices error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, mac_address } = req.body;

    if (!isValidId(id)) {
      return response.error(res, "Invalid device id", 400);
    }

    const existing = await deviceModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Device not found", 404);
    }

    const data = {};

    if (name !== undefined) {
      data.name = normalizeName(name);
    }

    if (type !== undefined) {
      if (!DEVICE_TYPES.includes(String(type))) {
        return response.error(res, `Invalid type. Allowed: ${DEVICE_TYPES.join(", ")}`, 400);
      }
      data.type = String(type);
    }

    if (mac_address !== undefined) {
      if (mac_address === null) {
        return response.error(res, "mac_address cannot be empty", 400);
      }

      const cleanMacAddress = normalizeMacAddress(mac_address);
      if (!cleanMacAddress) {
        return response.error(res, "mac_address cannot be empty", 400);
      }

      const dup = await deviceModel.findActiveByMacAddress(cleanMacAddress);
      if (dup && dup.id !== Number(id)) {
        return response.error(res, "Device mac_address already exists", 409);
      }

      data.mac_address = cleanMacAddress;
    }

    if (Object.keys(data).length === 0) {
      return response.error(res, "No fields to update", 400);
    }

    const updated = await deviceModel.updateDeviceById(id, data);
    return response.success(res, updated, "Device updated", 200);
  } catch (err) {
    console.error("updateDevice error:", err);
    if (isPrismaUniqueConstraintError(err)) {
      return response.error(res, "Device mac_address already exists", 409);
    }
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return response.error(res, "Invalid device id", 400);
    }

    const existing = await deviceModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Device not found", 404);
    }

    const isAssigned = await deviceModel.hasActiveBinDeviceMap(id);
    if (isAssigned) {
      return response.error(res, "This device is currently assigned to a bin and cannot be deleted.", 409);
    }

    const deleted = await deviceModel.softDeleteDeviceById(id);
    return response.success(res, deleted, "Device deleted", 200);
  } catch (err) {
    console.error("deleteDevice error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
