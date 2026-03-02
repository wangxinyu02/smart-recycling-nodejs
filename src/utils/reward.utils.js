// src/utils/reward.utils.js

function generatePromoCode(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isRewardCurrentlyValid(reward) {
  if (!reward) return false;
  if (reward.deleted_at) return false;
  if (reward.status !== "active") return false;

  const now = new Date();
  if (reward.starts_at && now < new Date(reward.starts_at)) return false;
  if (reward.expires_at && now > new Date(reward.expires_at)) return false;

  return true;
}

module.exports = { generatePromoCode, isRewardCurrentlyValid };