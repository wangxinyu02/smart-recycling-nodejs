// src/models/reward_redemption.model.js

const prisma = require("../config/prisma");

const selectRedemption = {
  id: true,
  reward_id: true,
  user_id: true,
  promo_code: true,
  redeemed_at: true,
  used_at: true,
  created_at: true,
  updated_at: true,
};

module.exports = {
  countByRewardId: (reward_id) => {
    return prisma.rewardRedemption.count({
      where: { reward_id: Number(reward_id) },
    });
  },

  countByRewardAndUser: (reward_id, user_id) => {
    return prisma.rewardRedemption.count({
      where: { reward_id: Number(reward_id), user_id: Number(user_id) },
    });
  },

  hasRedemptions: async (reward_id) => {
    const count = await prisma.rewardRedemption.count({
      where: { reward_id: Number(reward_id) },
    });
    return count > 0;
  },

  createRedemption: (data) => {
    return prisma.rewardRedemption.create({
      data,
      select: selectRedemption,
    });
  },

  getUserRedemptionSummary: async (user_id) => {
    const userId = Number(user_id);

    const grouped = await prisma.rewardRedemption.groupBy({
      by: ["used_at"],
      where: {
        user_id: userId,
      },
      _count: {
        id: true,
      },
    });

    let totalUsed = 0;
    let totalUnused = 0;

    grouped.forEach((row) => {
      if (row.used_at === null) {
        totalUnused = row._count.id;
      } else {
        totalUsed += row._count.id;
      }
    });

    const totalRedeemed = totalUsed + totalUnused;

    return {
      redeemed: totalRedeemed,
      used: totalUsed,
      unused: totalUnused,
    };
  },
};
