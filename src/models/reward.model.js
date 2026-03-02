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

  listRewards: ({ skip = 0, take = 20, q = "", merchant_id, status }) => {
    const keyword = q?.trim();

    const where = {
      deleted_at: null,
      ...(merchant_id ? { merchant_id: Number(merchant_id) } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { description: { contains: keyword } },
            ],
          }
        : {}),
    };

    return prisma.reward.findMany({
      where,
      skip,
      take,
      select: selectReward,
      orderBy: { created_at: "desc" },
    });
  },

  countRewards: ({ q = "", merchant_id, status }) => {
    const keyword = q?.trim();

    const where = {
      deleted_at: null,
      ...(merchant_id ? { merchant_id: Number(merchant_id) } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { description: { contains: keyword } },
            ],
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