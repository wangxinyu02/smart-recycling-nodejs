// src/config/notification.config.js

const templates = {
  bin_alert: {
    title: "Bin Alert",
    message: "{bin_name} bin is nearly full ({weight} kg)",
  },

  session_claimed: {
    title: "Points Earned",
    message: "You earned {points} points 🎉",
  },

  reward_redeemed: {
    title: "Reward Redeemed",
    message: "You redeemed {reward_name}",
  },

  system: {
    title: "System Notification",
    message: "{message}",
  },
};

// Replace variables in template
const replaceParams = (text, params = {}) => {
  let result = text;

  Object.keys(params).forEach((key) => {
    const value = params[key];
    result = result.replaceAll(`{${key}}`, value);
  });

  return result;
};

// Build notification from template
const buildNotification = (type, params = {}) => {
  const template = templates[type];

  if (!template) {
    throw new Error(`Notification template not found for type: ${type}`);
  }

  return {
    title: replaceParams(template.title, params),
    message: replaceParams(template.message, params),
    type,
  };
};

module.exports = {
  buildNotification,
};