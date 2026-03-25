// src/models/recycling_session.model.js

const prisma = require("../config/prisma");

const selectSession = {
  id: true,
  user_id: true,
  total_co2: true,
  started_at: true,
  ended_at: true,
  claimed_at: true,
  created_at: true,
  updated_at: true,
};

module.exports = {
  createSession: () => {
    return prisma.recyclingSession.create({
      data: {
        started_at: new Date(),
      },
      select: selectSession,
    });
  },

  getById: (id) => {
    return prisma.recyclingSession.findUnique({
      where: { id: Number(id) },
      select: selectSession,
    });
  },

  getByIdWithItems: (id) => {
    return prisma.recyclingSession.findUnique({
      where: { id: Number(id) },
      select: {
        ...selectSession,
        items: {
          select: {
            id: true,
            session_id: true,
            bin_id: true,
            material: true,
            weight: true,
            co2_saved: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
        },
      },
    });
  },

  listSessions: ({ skip = 0, take = 20, user_id, active_only }) => {
    const where = {
      ...(user_id ? { user_id: Number(user_id) } : {}),
      ...(active_only ? { ended_at: null } : {}),
    };

    return prisma.recyclingSession.findMany({
      where,
      select: selectSession,
      orderBy: { created_at: "desc" },
      skip,
      take,
    });
  },

  countSessions: ({ user_id, active_only }) => {
    const where = {
      ...(user_id ? { user_id: Number(user_id) } : {}),
      ...(active_only ? { ended_at: null } : {}),
    };

    return prisma.recyclingSession.count({ where });
  },

  updateSessionById: (id, data) => {
    return prisma.recyclingSession.update({
      where: { id: Number(id) },
      data: {
        ...(data.started_at !== undefined ? { started_at: data.started_at } : {}),
        ...(data.ended_at !== undefined ? { ended_at: data.ended_at } : {}),
      },
      select: selectSession,
    });
  },

  getSummaryById: async (id) => {
    const sessionId = Number(id);

    const session = await prisma.recyclingSession.findUnique({
      where: { id: sessionId },
      select: selectSession,
    });

    if (!session) return null;

    // Group items by material (Weight + CO2)
    const breakdownRaw = await prisma.recyclingItem.groupBy({
      by: ["material"],
      where: { session_id: sessionId },
      _sum: {
        weight: true,
        co2_saved: true,
      },
    });

    // Total points earned for this session
    const pointsAgg = await prisma.pointsTransaction.aggregate({
      where: {
        session_id: sessionId,
        type: "earn",
      },
      _sum: { points: true },
    });

    const breakdown = breakdownRaw.map((r) => ({
      material: r.material,
      weight_kg: Number(r._sum.weight ?? 0), // Decimal -> number
      co2_saved_kg: Number(r._sum.co2_saved ?? 0), // Decimal -> number
    }));

    const totals = breakdown.reduce(
      (acc, x) => {
        acc.total_weight_kg += x.weight_kg;
        acc.total_co2_saved_kg += x.co2_saved_kg;
        return acc;
      },
      { total_weight_kg: 0, total_co2_saved_kg: 0 },
    );

    return {
      session,
      points_earned: pointsAgg._sum.points ?? 0,
      breakdown,
      totals,
    };
  },

  listSessions: async ({ skip = 0, take = 20, user_id, active_only }) => {
    const where = {
      ...(user_id ? { user_id: Number(user_id) } : {}),
      ...(active_only ? { ended_at: null } : {}),
    };

    // 1) Base sessions
    const sessions = await prisma.recyclingSession.findMany({
      where,
      select: selectSession,
      orderBy: { created_at: "desc" },
      skip,
      take,
    });

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);

    // 2) Breakdown grouped by session_id + material
    const breakdownRaw = await prisma.recyclingItem.groupBy({
      by: ["session_id", "material"],
      where: { session_id: { in: sessionIds } },
      _sum: {
        weight: true,
        co2_saved: true,
      },
    });

    // 3) Points earned grouped by session_id
    const pointsRaw = await prisma.pointsTransaction.groupBy({
      by: ["session_id"],
      where: {
        session_id: { in: sessionIds },
        type: "earn",
      },
      _sum: { points: true },
    });

    const pointsMap = new Map(pointsRaw.map((r) => [r.session_id, Number(r._sum.points ?? 0)]));

    // 4) Build breakdownMap: session_id -> breakdown[]
    const breakdownMap = new Map();
    for (const r of breakdownRaw) {
      const sid = r.session_id;

      const arr = breakdownMap.get(sid) ?? [];
      arr.push({
        material: r.material,
        weight_kg: Number(r._sum.weight ?? 0),
        co2_saved_kg: Number(r._sum.co2_saved ?? 0),
      });
      breakdownMap.set(sid, arr);
    }

    // 5) Flatten response for frontend
    return sessions.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      claimed_at: s.claimed_at,
      total_co2: Number(s.total_co2 ?? 0),
      points_earned: pointsMap.get(s.id) ?? 0,
      breakdown: breakdownMap.get(s.id) ?? [],
    }));
  },

  // Average weight per completed session
  getAverageWeightPerSessionByUserId: async (user_id) => {
    const userId = Number(user_id);

    // 1. Total weight (only ended sessions)
    const weightAgg = await prisma.recyclingItem.aggregate({
      where: {
        session: {
          user_id: userId,
          ended_at: { not: null },
        },
      },
      _sum: {
        weight: true,
      },
    });

    // 2. Count completed sessions
    const totalSessions = await prisma.recyclingSession.count({
      where: {
        user_id: userId,
        ended_at: { not: null },
      },
    });

    const totalWeight = Number(weightAgg._sum.weight ?? 0);

    if (totalSessions === 0) {
      return {
        average_weight_per_session: 0,
      };
    }

    return {
      average_weight_per_session: Number((totalWeight / totalSessions).toFixed(2)),
    };
  },
};
