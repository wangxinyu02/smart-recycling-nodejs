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

  createRedemption: (data) => {
    return prisma.rewardRedemption.create({
      data,
      select: selectRedemption,
    });
  },
};
