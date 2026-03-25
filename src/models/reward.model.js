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

const buildRewardWhere = ({ q = "", merchant_id, status, filter = "all", user_id }) => {
  const keyword = q?.trim();
  const now = new Date();

  return {
    deleted_at: null,
    ...(merchant_id ? { merchant_id: Number(merchant_id) } : {}),
    ...(status ? { status } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { description: { contains: keyword } },
            {
              merchant: {
                name: { contains: keyword },
              },
            },
          ],
        }
      : {}),
    ...(filter === "redeemed" && user_id
      ? {
          redemptions: {
            some: {
              user_id: Number(user_id),
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
    ...(filter === "expired"
      ? {
          expires_at: { lt: now },
        }
      : {}),
  };
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

  listRewards: async ({ skip = 0, take = 20, q = "", merchant_id, status, filter = "all", user_id }) => {
    const now = new Date();

    const where = buildRewardWhere({
      q,
      merchant_id,
      status,
      filter,
      user_id,
    });

    const rows = await prisma.reward.findMany({
      where,
      skip,
      take,
      select: selectRewardWithMerchant,
      orderBy: { created_at: "desc" },
    });

    if (!rows.length) {
      return [];
    }

    const rewardIds = rows.map((row) => row.id);

    const [userRedeemCounts, totalRedeemCounts, userUnusedRedeemCounts, userUsedRedeemCounts] = await Promise.all([
      user_id
        ? prisma.rewardRedemption.groupBy({
            by: ["reward_id"],
            where: {
              reward_id: { in: rewardIds },
              user_id: Number(user_id),
            },
            _count: {
              id: true,
            },
          })
        : Promise.resolve([]),

      prisma.rewardRedemption.groupBy({
        by: ["reward_id"],
        where: {
          reward_id: { in: rewardIds },
        },
        _count: {
          id: true,
        },
      }),

      user_id
        ? prisma.rewardRedemption.groupBy({
            by: ["reward_id"],
            where: {
              reward_id: { in: rewardIds },
              user_id: Number(user_id),
              used_at: null,
            },
            _count: {
              id: true,
            },
          })
        : Promise.resolve([]),

      user_id
        ? prisma.rewardRedemption.groupBy({
            by: ["reward_id"],
            where: {
              reward_id: { in: rewardIds },
              user_id: Number(user_id),
              used_at: { not: null },
            },
            _count: {
              id: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const userRedeemCountMap = new Map(userRedeemCounts.map((item) => [item.reward_id, item._count.id]));

    const totalRedeemCountMap = new Map(totalRedeemCounts.map((item) => [item.reward_id, item._count.id]));

    const userUnusedRedeemCountMap = new Map(userUnusedRedeemCounts.map((item) => [item.reward_id, item._count.id]));

    const userUsedRedeemCountMap = new Map(userUsedRedeemCounts.map((item) => [item.reward_id, item._count.id]));

    return rows.map((r) => {
      const userRedeemedCount = userRedeemCountMap.get(r.id) || 0;
      const totalRedeemedCount = totalRedeemCountMap.get(r.id) || 0;
      const unusedRedemptionCount = userUnusedRedeemCountMap.get(r.id) || 0;
      const usedRedemptionCount = userUsedRedeemCountMap.get(r.id) || 0;

      const maxPerUser = r.max_per_user;
      const maxRedemptions = r.max_redemptions;

      const isExpired = r.expires_at ? new Date(r.expires_at) < now : false;
      const isUserLimitReached = maxPerUser != null && userRedeemedCount >= maxPerUser;
      const isFullyRedeemed = maxRedemptions != null && totalRedeemedCount >= maxRedemptions;

      const remainingUserRedemptions = maxPerUser == null ? null : Math.max(maxPerUser - userRedeemedCount, 0);

      const remainingTotalRedemptions = maxRedemptions == null ? null : Math.max(maxRedemptions - totalRedeemedCount, 0);

      let redeemBlockReason = null;

      if (r.status !== "active") {
        redeemBlockReason = "inactive";
      } else if (isExpired) {
        redeemBlockReason = "expired";
      } else if (isFullyRedeemed) {
        redeemBlockReason = "fully_redeemed";
      } else if (isUserLimitReached) {
        redeemBlockReason = "user_limit_reached";
      }

      let useBlockReason = null;

      if (r.status !== "active") {
        useBlockReason = "inactive";
      } else if (isExpired) {
        useBlockReason = "expired";
      } else if (userRedeemedCount <= 0) {
        useBlockReason = "not_redeemed";
      } else if (unusedRedemptionCount <= 0) {
        useBlockReason = "fully_used";
      }

      return {
        ...r,
        merchant_name: r.merchant?.name ?? null,
        merchant: undefined,

        user_redeemed_count: userRedeemedCount,
        total_redeemed_count: totalRedeemedCount,
        used_redemption_count: usedRedemptionCount,
        unused_redemption_count: unusedRedemptionCount,

        remaining_user_redemptions: remainingUserRedemptions,
        remaining_total_redemptions: remainingTotalRedemptions,

        is_user_limit_reached: isUserLimitReached,
        is_fully_redeemed: isFullyRedeemed,

        can_redeem: redeemBlockReason == null,
        redeem_block_reason: redeemBlockReason,

        can_use: useBlockReason == null,
        use_block_reason: useBlockReason,
      };
    });
  },

  countRewards: ({ q = "", merchant_id, status, filter = "all", user_id }) => {
    const where = buildRewardWhere({
      q,
      merchant_id,
      status,
      filter,
      user_id,
    });

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
