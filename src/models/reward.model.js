// src/models/reward.model.js

const prisma = require("../config/prisma");

const selectReward = {
  id: true,
  merchant_id: true,
  name: true,
  description: true,
  points_needed: true,
  max_redemptions: true,
  max_per_user: true,
  starts_at: true,
  expires_at: true,
  status: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
};

const selectRewardWithMerchant = {
  ...selectReward,
  merchant: {
    select: {
      id: true,
      name: true,
    },
  },
};

module.exports = {
  createReward: (data) => {
    return prisma.reward.create({
      data,
      select: selectReward,
    });
  },

  findActiveById: (id) => {
    return prisma.reward.findFirst({
      where: { id: Number(id), deleted_at: null },
      select: selectReward,
    });
  },

  listRewards: ({ skip = 0, take = 20, q = "", merchant_id, status, filter = "all", user_id }) => {
    const keyword = q?.trim();

    const where = {
      deleted_at: null,
      ...(merchant_id ? { merchant_id: Number(merchant_id) } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [{ name: { contains: keyword } }, { description: { contains: keyword } }],
          }
        : {}),
      ...(filter === "redeemed" && user_id
        ? {
            redemptions: {
              some: {
                user_id: Number(user_id),
                // used_at: null,
              },
            },
          }
        : {}),
      ...(filter === "used" && user_id
        ? {
            redemptions: {
              some: {
                user_id: Number(user_id),
                used_at: { not: null },
              },
            },
          }
        : {}),
      ...(filter === "expired" && user_id
        ? {
            redemptions: {
              some: {
                user_id: Number(user_id),
                used_at: null,
              },
            },
          }
        : {}),
    };

    return prisma.reward
      .findMany({
        where,
        skip,
        take,
        select: selectRewardWithMerchant,
        orderBy: { created_at: "desc" },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          merchant_name: r.merchant?.name ?? null,
          merchant: undefined,
        })),
      );
  },

  countRewards: ({ q = "", merchant_id, status }) => {
    const keyword = q?.trim();

    const where = {
      deleted_at: null,
      ...(merchant_id ? { merchant_id: Number(merchant_id) } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [{ name: { contains: keyword } }, { description: { contains: keyword } }],
          }
        : {}),
    };

    return prisma.reward.count({ where });
  },

  updateRewardById: (id, data) => {
    return prisma.reward.update({
      where: { id: Number(id) },
      data,
      select: selectReward,
    });
  },

  softDeleteRewardById: (id) => {
    return prisma.reward.update({
      where: { id: Number(id) },
      data: { deleted_at: new Date() },
      select: selectReward,
    });
  },
  
};
