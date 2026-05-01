// src/config/notification.config.js

const templates = {
  bin_alert: {
    variants: {
      half_full: {
        title: "{bin_name} Half Full",
        message: "{bin_name} is 50% full. Current weight: {current_weight}kg / {max_weight}kg.",
      },
      full: {
        title: "{bin_name} Almost Full",
        message: "{bin_name} is almost full. Please empty the bin soon. Current weight: {current_weight}kg / {max_weight}kg.",
      },
    },
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
  const baseTemplate = templates[type];

  if (!baseTemplate) {
    throw new Error(`Notification template not found for type: ${type}`);
  }

  const template = params.variant
    ? baseTemplate.variants?.[params.variant]
    : baseTemplate;

  if (!template?.title || !template?.message) {
    throw new Error(`Notification template variant not found for type: ${type}`);
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
