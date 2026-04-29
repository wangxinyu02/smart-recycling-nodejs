// src/controllers/recycling.controller.js

const crypto = require("crypto");
const prisma = require("../config/prisma");
const sessionModel = require("../models/recycling_session.model");
const response = require("../utils/response.utils");
const { calcCo2Saved, buildCo2ImpactMessage } = require("../utils/co2.utils");
const { toNumberOrNull, round2 } = require("../utils/number.utils");
const { capitalizeFirstLetter } = require("../utils/string.utils");
const { MATERIALS } = require("../config/material.config");
const notificationService = require("../services/notification.service");
const { buildNotification } = require("../config/notification.config");
const { publishBinCommand } = require("../services/mqtt.service");

exports.createSession = async (req, res) => {
  try {
    const session = await sessionModel.createSession();

    return response.success(res, { id: session.id }, "Session created successfully", 201);
  } catch (err) {
    console.error("createSession error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.startSession = async (req, res) => {
  try {
    const binId = Number(req.body?.bin_id);

    if (!Number.isInteger(binId) || binId <= 0) {
      return response.error(res, "Invalid bin_id", 400);
    }

    // const activeSession = await prisma.recyclingSession.findFirst({
    //   where: {
    //     bin_id: binId,
    //     ended_at: null,
    //   },
    //   select: { id: true },
    // });

    // if (activeSession) {
    //   return response.error(res, "This bin already has an active session", 409);
    // }

    const bin = await prisma.bin.findUnique({
      where: { id: binId },
      select: {
        id: true,
        current_weight: true,
        status: true,
        last_seen_at: true,
      },
    });

    if (!bin) {
      return response.error(res, "Bin not found", 404);
    }

    const session = await prisma.recyclingSession.create({
      data: {
        bin_id: binId,
        start_weight: bin.current_weight,
        started_at: new Date(),
      },
      select: {
        id: true,
        bin_id: true,
        start_weight: true,
        started_at: true,
      },
    });

    const mqttCommandSent = publishBinCommand(binId, "start_session", {
      session_id: session.id,
    });

    return response.success(
      res,
      {
        session_id: session.id,
        bin_id: session.bin_id,
        start_weight: Number(session.start_weight ?? 0),
        current_weight: Number(bin.current_weight ?? 0),
        deposited_weight: 0,
        mqtt_command_sent: mqttCommandSent,
        last_seen_at: bin.last_seen_at,
      },
      "Session started successfully",
      201,
    );
  } catch (err) {
    console.error("startSession error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

exports.getBinStatus = async (req, res) => {
  try {
    const binId = Number(req.params.bin_id);
    if (!Number.isInteger(binId) || binId <= 0) {
      return response.error(res, "Invalid bin id", 400);
    }

    const bin = await prisma.bin.findUnique({
      where: { id: binId },
      select: {
        id: true,
        current_weight: true,
        status: true,
        last_seen_at: true,
      },
    });

    if (!bin) {
      return response.error(res, "Bin not found", 404);
    }

    return response.success(
      res,
      {
        bin_id: bin.id,
        current_weight: Number(bin.current_weight ?? 0),
        status: bin.status,
        last_seen_at: bin.last_seen_at,
      },
      "Bin status fetched successfully",
      200,
    );
  } catch (err) {
    console.error("getBinStatus error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
exports.getSessionLiveWeight = async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return response.error(res, "Invalid session id", 400);
    }

    const session = await prisma.recyclingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        bin_id: true,
        start_weight: true,
        ended_at: true,
        bin: {
          select: {
            id: true,
            current_weight: true,
            status: true,
            last_seen_at: true,
          },
        },
      },
    });

    if (!session) {
      return response.error(res, "Session not found", 404);
    }

    if (!session.bin_id || !session.bin) {
      return response.error(res, "Session is not linked to a bin", 400);
    }

    const startWeight = Number(session.start_weight ?? 0);
    const currentWeight = Number(session.bin.current_weight ?? 0);
    const depositedWeight = Math.max(0, round2(currentWeight - startWeight));

    return response.success(
      res,
      {
        session_id: session.id,
        bin_id: session.bin_id,
        start_weight: startWeight,
        current_weight: currentWeight,
        deposited_weight: depositedWeight,
        status: session.bin.status,
        last_seen_at: session.bin.last_seen_at,
        is_active: !session.ended_at,
      },
      "Live session weight fetched successfully",
      200,
    );
  } catch (err) {
    console.error("getSessionLiveWeight error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = Number(id);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return response.error(res, "Invalid session id", 400);
    }

    const session = await sessionModel.getSummaryById(sessionId);
    if (!session) {
      return response.error(res, "Session not found", 404);
    }

    if (req.user?.role !== "admin" && req.user?.id !== session.user_id) {
      return response.error(res, "Forbidden", 403);
    }

    return response.success(res, session, "Session fetched successfully", 200);
  } catch (err) {
    console.error("getSessionById error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.listSessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!Number.isInteger(userId) || userId <= 0) {
      return response.error(res, "Unauthorized", 401);
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    // Admin can list all or filter by user_id; normal user only sees own
    const requestedUserId = req.query.user_id ? Number(req.query.user_id) : undefined;
    const active_only = req.query.active_only === "true";

    const effectiveUserId = req.user?.role === "admin" ? requestedUserId : userId;

    const [items, total] = await Promise.all([
      sessionModel.listSessions({
        skip,
        take: limit,
        user_id: effectiveUserId,
        active_only,
      }),
      sessionModel.countSessions({
        user_id: effectiveUserId,
        active_only,
      }),
    ]);

    // ✅ Add impact_message to each item
    const itemsWithImpact = items.map((session) => {
      const totalCo2 = session.total_co2 || 0;

      return {
        ...session,
        impact_message: {
          headline: `You helped reduce ${totalCo2}kg of CO₂ ✅`,
          description: buildCo2ImpactMessage(totalCo2).text,
        },
      };
    });

    return response.success(
      res,
      {
        items: itemsWithImpact,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
      "Sessions retrieved",
      200,
    );
  } catch (err) {
    console.error("listSessions error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

const endSessionFromBreakdown = async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return response.error(res, "Invalid session id", 400);
    }

    const { breakdown } = req.body;
    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return response.error(res, "breakdown must be a non-empty array", 400);
    }

    const rows = breakdown
      .map((r, idx) => {
        const bin_id = Number(r?.bin_id);
        const rawWeight = toNumberOrNull(r?.weight);

        if (!Number.isInteger(bin_id) || bin_id <= 0) {
          const err = new Error(`Invalid bin_id at index ${idx}`);
          err.statusCode = 400;
          throw err;
        }

        if (rawWeight === null || rawWeight < 0) {
          const err = new Error(`Invalid weight at index ${idx}`);
          err.statusCode = 400;
          throw err;
        }

        const weight = round2(rawWeight);

        return { bin_id, weight };
      })
      .filter((r) => r.weight > 0);

    if (rows.length === 0) {
      return response.error(res, "All weights are 0", 400);
    }

    // ✅ Merge duplicate bin_id
    const mergedMap = new Map();
    for (const r of rows) {
      const current = mergedMap.get(r.bin_id) ?? 0;
      mergedMap.set(r.bin_id, round2(current + r.weight));
    }

    const merged = Array.from(mergedMap.entries()).map(([bin_id, weight]) => ({
      bin_id,
      weight: round2(weight),
    }));

    const result = await prisma.$transaction(async (tx) => {
      // ✅ Validate session inside tx
      const session = await tx.recyclingSession.findUnique({
        where: { id: sessionId },
        select: { id: true, ended_at: true },
      });

      if (!session) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
      }

      if (session.ended_at) {
        const err = new Error("Session already ended");
        err.statusCode = 400;
        throw err;
      }

      const binIds = merged.map((x) => x.bin_id);
      const bins = await tx.bin.findMany({
        where: { id: { in: binIds } },
        select: { id: true, material: true },
      });

      const binMap = new Map(bins.map((b) => [b.id, b]));

      for (const bid of binIds) {
        if (!binMap.has(bid)) {
          const err = new Error(`Bin not found: ${bid}`);
          err.statusCode = 404;
          throw err;
        }
      }

      let totalWeight = 0;
      let totalCo2 = 0;

      for (const row of merged) {
        const material = binMap.get(row.bin_id).material;
        const co2 = round2(calcCo2Saved(material, row.weight));

        totalWeight = round2(totalWeight + row.weight);
        totalCo2 = round2(totalCo2 + co2);

        await tx.recyclingItem.create({
          data: {
            session_id: sessionId,
            bin_id: row.bin_id,
            material,
            weight: row.weight,
            co2_saved: co2,
          },
        });
      }

      await tx.recyclingSession.update({
        where: { id: sessionId },
        data: {
          total_co2: totalCo2,
          ended_at: new Date(),
        },
      });

      const qr_payload = generateQrPayload(sessionId);

      return {
        id: sessionId,
        total_weight: totalWeight,
        total_co2: totalCo2,
        qr_payload,
      };
    });

    return response.success(res, result, "Session ended successfully", 200);
  } catch (err) {
    console.error("endSession error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

exports.endSession = async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return response.error(res, "Invalid session id", 400);
    }

    let commandBinId = null;

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.recyclingSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          bin_id: true,
          start_weight: true,
          ended_at: true,
        },
      });

      if (!session) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
      }

      if (session.ended_at) {
        const err = new Error("Session already ended");
        err.statusCode = 400;
        throw err;
      }

      if (!session.bin_id) {
        const err = new Error("Session is not linked to a bin");
        err.statusCode = 400;
        throw err;
      }

      if (session.start_weight === null || session.start_weight === undefined) {
        const err = new Error("Session start_weight is missing");
        err.statusCode = 400;
        throw err;
      }

      const bin = await tx.bin.findUnique({
        where: { id: session.bin_id },
        select: {
          id: true,
          material: true,
          current_weight: true,
        },
      });

      if (!bin) {
        const err = new Error(`Bin not found: ${session.bin_id}`);
        err.statusCode = 404;
        throw err;
      }

      const startWeight = Number(session.start_weight);
      const finalWeight = Number(bin.current_weight ?? 0);
      const depositedWeight = Math.max(0, round2(finalWeight - startWeight));

      if (depositedWeight <= 0) {
        const err = new Error("No deposited weight detected");
        err.statusCode = 400;
        throw err;
      }

      const totalCo2 = round2(calcCo2Saved(bin.material, depositedWeight));

      await tx.recyclingItem.create({
        data: {
          session_id: sessionId,
          bin_id: bin.id,
          material: bin.material,
          weight: depositedWeight,
          co2_saved: totalCo2,
        },
      });

      await tx.recyclingSession.update({
        where: { id: sessionId },
        data: {
          total_co2: totalCo2,
          final_weight: finalWeight.toFixed(2),
          ended_at: new Date(),
        },
      });

      commandBinId = bin.id;
      const qr_payload = generateQrPayload(sessionId);

      return {
        id: sessionId,
        bin_id: bin.id,
        start_weight: startWeight,
        final_weight: finalWeight,
        deposited_weight: depositedWeight,
        total_weight: depositedWeight,
        total_co2: totalCo2,
        qr_payload,
      };
    });

    result.mqtt_command_sent = publishBinCommand(commandBinId, "end_session", {
      session_id: sessionId,
    });

    return response.success(res, result, "Session ended successfully", 200);
  } catch (err) {
    console.error("endSession error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

function generateQrPayload(sessionId) {
  const ts = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const data = `${sessionId}|${ts}|${nonce}`;
  const secret = process.env.QR_SECRET;

  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");

  return `sid=${sessionId}&ts=${ts}&nonce=${nonce}&sig=${sig}`;
}

const QR_SECRET = process.env.QR_SECRET || "change-me";
const QR_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function signQr({ sid, ts, nonce }) {
  const msg = `${sid}|${ts}|${nonce}`;
  return crypto.createHmac("sha256", QR_SECRET).update(msg).digest("hex");
}

function parseQrPayload(payload) {
  // expects: sid=123&ts=1710000000000&nonce=abc&sig=....
  const params = new URLSearchParams(String(payload));
  const sid = params.get("sid");
  const ts = params.get("ts");
  const nonce = params.get("nonce");
  const sig = params.get("sig");
  return { sid, ts, nonce, sig };
}

function verifyQrPayload(payload) {
  const { sid, ts, nonce, sig } = parseQrPayload(payload);

  const sidNum = Number(sid);
  const tsNum = Number(ts);

  if (!Number.isInteger(sidNum) || sidNum <= 0) return { ok: false, reason: "QR code is invalid. Please try again." };
  if (!Number.isFinite(tsNum) || tsNum <= 0) return { ok: false, reason: "QR code is invalid. Please try again." };
  if (!nonce || typeof nonce !== "string" || nonce.length < 6) return { ok: false, reason: "QR code is invalid. Please try again." };
  if (!sig || typeof sig !== "string") return { ok: false, reason: "QR code is invalid. Please try again." };

  const age = Date.now() - tsNum;
  if (age < 0 || age > QR_MAX_AGE_MS) return { ok: false, reason: "QR code is expired. Please try again." };

  const expected = signQr({ sid: sidNum, ts: tsNum, nonce });
  if (!safeEqual(sig, expected)) return { ok: false, reason: "QR code is invalid. Please try again." };

  return { ok: true, session_id: sidNum };
}

function computeEarnPoints(total_co2) {
  const co2 = Number(total_co2 ?? 0);
  const points = Math.ceil(co2); // ceiling rule
  return Math.max(1, points); // guarantee minimum 1 point
}

exports.claimSession = async (req, res) => {
  try {
    const userId = req.user?.id;

    const { qr_payload } = req.body;
    if (!qr_payload || typeof qr_payload !== "string") {
      return response.error(res, "qr_payload is required", 400);
    }

    const v = verifyQrPayload(qr_payload);
    if (!v.ok) {
      return response.error(res, `${v.reason}`, 400);
    }

    const sessionId = v.session_id;

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load session
      const session = await tx.recyclingSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          user_id: true,
          started_at: true,
          ended_at: true,
          claimed_at: true,
          total_co2: true,
        },
      });

      if (!session) {
        const err = new Error("Session not found.");
        err.statusCode = 404;
        throw err;
      }

      // 2) Must be ended
      if (!session.ended_at) {
        const err = new Error("Session not ended yet.");
        err.statusCode = 400;
        throw err;
      }

      // 3) Must not be claimed
      if (session.claimed_at || session.user_id) {
        const err = new Error("Session already claimed.");
        err.statusCode = 409;
        throw err;
      }

      // 4) Attach to user
      await tx.recyclingSession.update({
        where: { id: sessionId },
        data: {
          user_id: Number(userId),
          claimed_at: new Date(),
        },
      });

      // 5) Create earn points
      const existingEarn = await tx.pointsTransaction.findFirst({
        where: { session_id: sessionId, type: "earn" },
        select: { id: true },
      });

      let pointsEarned = 0;

      if (!existingEarn) {
        pointsEarned = computeEarnPoints(session.total_co2);

        await tx.pointsTransaction.create({
          data: {
            user_id: Number(userId),
            points: Number(pointsEarned),
            type: "earn",
            session_id: sessionId,
            redemption_id: null,
          },
        });
      } else {
        // already earned (shouldn't happen if claim is locked properly, but safe)
        const sum = await tx.pointsTransaction.aggregate({
          where: { session_id: sessionId, type: "earn" },
          _sum: { points: true },
        });
        pointsEarned = sum._sum.points ?? 0;
      }

      return { pointsEarned };
    });

    // 6) Return summary for screen
    const summary = await sessionModel.getSummaryById(sessionId);
    if (!summary) return response.error(res, "Session not found", 404);

    // overwrite points_earned from transaction result (source of truth)
    summary.points_earned = result.pointsEarned;

    const built = buildNotification("session_claimed", {
      points: result.pointsEarned,
    });

    await notificationService.notifyUser({
      userId,
      title: built.title,
      message: built.message,
      type: built.type,
      referenceId: sessionId,
      data: {
        screen: "notifications",
        session_id: sessionId,
      },
    });

    const impact_message = {
      headline: `You helped reduce ${summary.session.total_co2}kg of CO₂ ✅`,
      description: buildCo2ImpactMessage(summary.session.total_co2).text,
    };

    return response.success(res, { ...summary, impact_message }, "Session claimed successfully", 200);
  } catch (err) {
    console.error("claimSession error:", err);
    return response.error(res, err.message || "Internal Server Error", err.statusCode || 500);
  }
};

exports.getTopRecycledMaterial = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    const currentYear = new Date().getFullYear();
    const year = req.query.year ? Number(req.query.year) : currentYear;

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.error(res, "Unauthorized", 401);
    }

    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return response.error(res, "Invalid year", 400);
    }

    const sessionWhere = {
      claimed_at: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    };

    // user only sees own data
    if (role !== "admin") {
      sessionWhere.user_id = Number(userId);
    }

    // optional year filter
    if (year !== null) {
      sessionWhere.claimed_at = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      };
    }

    const grouped = await prisma.recyclingItem.groupBy({
      by: ["material"],
      where: {
        session: sessionWhere,
      },
      _sum: {
        weight: true,
      },
      orderBy: {
        _sum: {
          weight: "desc",
        },
      },
    });

    if (!grouped.length) {
      return response.success(
        res,
        {
          top_material: null,
          summary: "No recycled material data found.",
          filter: {
            year,
            scope: role === "admin" ? "all_users" : "own",
          },
          materials: [],
        },
        "Top recycled material fetched successfully",
        200,
      );
    }

    const materialsWithWeight = grouped.map((item) => ({
      name: capitalizeFirstLetter(item.material),
      weight_kg: Number(Number(item._sum.weight || 0).toFixed(1)),
    }));

    const totalWeight = materialsWithWeight.reduce((sum, item) => sum + item.weight_kg, 0);

    const materials = materialsWithWeight.map((item) => ({
      name: item.name,
      value: item.weight_kg,
      title: `${item.name} \n ${totalWeight > 0 ? Number(((item.weight_kg / totalWeight) * 100).toFixed(1)) : 0}%`,
    }));

    const topMaterial = materials[0];

    return response.success(
      res,
      {
        summary: capitalizeFirstLetter(topMaterial.name),
        filter: {
          year,
          scope: role === "admin" ? "all_users" : "own",
        },
        materials,
      },
      "Top recycled material fetched successfully",
      200,
    );
  } catch (err) {
    console.error("getTopRecycledMaterial error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.getRecyclableWeightOverTime = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    const currentYear = new Date().getFullYear();
    const year = req.query.year ? Number(req.query.year) : currentYear;

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.error(res, "Unauthorized", 401);
    }

    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return response.error(res, "Invalid year", 400);
    }

    const sessionWhere = {
      claimed_at: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    };

    if (role !== "admin") {
      sessionWhere.user_id = Number(userId);
    }

    const grouped = await prisma.recyclingItem.groupBy({
      by: ["material", "created_at"],
      where: {
        session: sessionWhere,
      },
      _sum: {
        weight: true,
      },
      orderBy: [{ created_at: "asc" }, { material: "asc" }],
    });

    // ✅ Legend based on config
    const legend = MATERIALS.map((material) => ({
      key: material,
      label: capitalizeFirstLetter(material),
    }));

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthMap = new Map();

    for (let i = 1; i <= 12; i += 1) {
      monthMap.set(i, {
        x: i - 1,
        month: i,
        label: monthLabels[i - 1],
        value: 0,
        materials: MATERIALS.map((material) => ({
          key: material,
          value: 0,
        })),
      });
    }

    for (const row of grouped) {
      const materialKey = String(row.material || "").toLowerCase();
      const date = new Date(row.created_at);
      const month = date.getUTCMonth() + 1;

      if (!monthMap.has(month)) continue;

      const monthEntry = monthMap.get(month);
      const weight = Number(Number(row._sum.weight || 0).toFixed(1));

      const materialIndex = monthEntry.materials.findIndex((item) => item.key === materialKey);

      if (materialIndex >= 0) {
        monthEntry.materials[materialIndex].value = Number((monthEntry.materials[materialIndex].value + weight).toFixed(1));
      }

      monthEntry.value = Number((monthEntry.value + weight).toFixed(1));
    }

    const months = Array.from(monthMap.values());

    return response.success(
      res,
      {
        filter: {
          year,
          scope: role === "admin" ? "all_users" : "own",
        },
        legend,
        months,
      },
      "Recyclable weight over time fetched successfully",
      200,
    );
  } catch (err) {
    console.error("getRecyclableWeightOverTime error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

