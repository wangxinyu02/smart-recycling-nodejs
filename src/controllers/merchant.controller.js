// src/controllers/merchant.controller.js

const merchantModel = require("../models/merchant.model");
const response = require("../utils/response.utils");

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

exports.createMerchant = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return response.error(res, "Name and email are required", 400);
    }

    const normalizedEmail = normalizeEmail(email);
    const cleanName = String(name).trim();

    if (cleanName.length < 2) {
      return response.error(res, "Name is too short", 400);
    }

    const existing = await merchantModel.findActiveByEmail(normalizedEmail);
    if (existing) {
      return response.error(res, "Merchant email already exists", 409);
    }

    const merchant = await merchantModel.createMerchant({
      name: cleanName,
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : null,
    });

    return response.success(res, merchant, "Merchant created", 201);
  } catch (err) {
    console.error("createMerchant error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getMerchantById = async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await merchantModel.findActiveById(id);
    if (!merchant) {
      return response.error(res, "Merchant not found", 404);
    }

    return response.success(res, merchant, "Merchant retrieved", 200);
  } catch (err) {
    console.error("getMerchantById error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.listMerchants = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const q = req.query.q ? String(req.query.q) : "";

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([merchantModel.listMerchants({ skip, take: limit, q }), merchantModel.countMerchants({ q })]);

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
      "Merchants retrieved",
      200,
    );
  } catch (err) {
    console.error("listMerchants error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.updateMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    const existing = await merchantModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Merchant not found", 404);
    }

    const data = {};

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (cleanName.length < 2) return response.error(res, "Name is too short", 400);
      data.name = cleanName;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);

      // Check duplicate email (exclude self)
      const dup = await merchantModel.findActiveByEmail(normalizedEmail);
      if (dup && dup.id !== Number(id)) {
        return response.error(res, "Merchant email already exists", 409);
      }

      data.email = normalizedEmail;
    }

    if (phone !== undefined) {
      data.phone = phone ? String(phone).trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return response.error(res, "No fields to update", 400);
    }

    const updated = await merchantModel.updateMerchantById(id, data);
    return response.success(res, updated, "Merchant updated", 200);
  } catch (err) {
    console.error("updateMerchant error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.deleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await merchantModel.findActiveById(id);
    if (!existing) {
      return response.error(res, "Merchant not found", 404);
    }

    const deleted = await merchantModel.softDeleteMerchantById(id);
    return response.success(res, deleted, "Merchant deleted", 200);
  } catch (err) {
    console.error("deleteMerchant error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
