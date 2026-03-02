// src/controllers/bin.controller.js

const binModel = require("../models/bin.model");
const response = require("../utils/response.utils");

const ALLOWED_MATERIALS = ["plastic", "paper", "metal", "glass", "ewaste", "other"];

exports.createBin = async (req, res) => {
  try {
    const { name, material } = req.body;

    if (!material) return response.error(res, "material is required", 400);
    if (!ALLOWED_MATERIALS.includes(String(material))) {
      return response.error(res, `Invalid material. Allowed: ${ALLOWED_MATERIALS.join(", ")}`, 400);
    }

    let cleanName = null;
    if (name !== undefined && name !== null) {
      if (typeof name !== "string") return response.error(res, "name must be a string", 400);
      cleanName = name.trim();
      if (cleanName.length === 0) cleanName = null;
      if (cleanName && cleanName.length > 120) return response.error(res, "name is too long (max 120)", 400);
    }

    const created = await binModel.createBin({
      name: cleanName,
      material: String(material),
    });

    return response.success(res, created, "Bin created successfully", 201);
  } catch (err) {
    console.error("createBin error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
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

    if (material && !ALLOWED_MATERIALS.includes(material)) {
      return response.error(res, `Invalid material filter. Allowed: ${ALLOWED_MATERIALS.join(", ")}`, 400);
    }

    const [items, total] = await Promise.all([
      binModel.listBins({ skip, take: limit, q, material }),
      binModel.countBins({ q, material }),
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
      "Bins retrieved",
      200
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

    const { name, material } = req.body;
    const data = {};

    if (name !== undefined) {
      if (name === null) {
        data.name = null;
      } else {
        if (typeof name !== "string") return response.error(res, "name must be a string", 400);
        const cleanName = name.trim();
        data.name = cleanName.length === 0 ? null : cleanName;
        if (data.name && data.name.length > 120) return response.error(res, "name is too long (max 120)", 400);
      }
    }

    if (material !== undefined) {
      if (!ALLOWED_MATERIALS.includes(String(material))) {
        return response.error(res, `Invalid material. Allowed: ${ALLOWED_MATERIALS.join(", ")}`, 400);
      }
      data.material = String(material);
    }

    if (Object.keys(data).length === 0) {
      return response.error(res, "No fields to update", 400);
    }

    const updated = await binModel.updateBinById(binId, data);
    return response.success(res, updated, "Bin updated successfully", 200);
  } catch (err) {
    console.error("updateBin error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
