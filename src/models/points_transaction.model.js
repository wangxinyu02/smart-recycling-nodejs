// src/models/points_transaction.model.js

const prisma = require("../config/prisma");

const selectTxn = {
  id: true,
  user_id: true,
  points: true,
  type: true,
  session_id: true,
  redemption_id: true,
  created_at: true,
};

module.exports = {
  createTxn: (data) => {
    return prisma.pointsTransaction.create({
      data,
      select: selectTxn,
    });
  },

  getTotalPointsByUserId: async (user_id) => {
    const result = await prisma.pointsTransaction.aggregate({
      where: { user_id: Number(user_id) },
      _sum: { points: true },
    });

    return result._sum.points ?? 0;
  },

  listByUserId: ({ user_id, skip = 0, take = 20, type }) => {
    return prisma.pointsTransaction.findMany({
      where: {
        user_id: Number(user_id),
        ...(type ? { type } : {}),
      },
      select: selectTxn,
      orderBy: { created_at: "desc" },
      skip,
      take,
    });
  },

  countByUserId: ({ user_id, type }) => {
    return prisma.pointsTransaction.count({
      where: {
        user_id: Number(user_id),
        ...(type ? { type } : {}),
      },
    });
  },

  getPointsSummaryByUserId: async (user_id) => {
    const result = await prisma.pointsTransaction.groupBy({
      by: ["type"],
      where: {
        user_id: Number(user_id),
      },
      _sum: {
        points: true,
      },
    });

    let earned = 0;
    let spent = 0;

    result.forEach((row) => {
      if (row.type === "earn" || row.type === "refund") {
        earned += Number(row._sum.points || 0);
      }

      if (row.type === "redeem") {
        spent += Math.abs(Number(row._sum.points || 0));
      }

      // optional: if adjust exists
      if (row.type === "adjust") {
        const val = Number(row._sum.points || 0);
        if (val >= 0) earned += val;
        else spent += Math.abs(val);
      }
    });

    return {
      earned,
      spent,
    };
  },
};
