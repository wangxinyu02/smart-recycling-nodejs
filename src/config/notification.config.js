// src/config/notification.config.js

const templates = {
  bin_alert: {
    variants: {
      half_full: {
        title: "{bin_name} Half Full",
        message: "{bin_name} has reached 50% capacity. Current weight: {current_weight}kg / {max_weight}kg.",
      },
      full: {
        title: "{bin_name} Almost Full",
        message: "{bin_name} is almost full🚨 Please empty it soon to avoid overflow. Current weight: {current_weight}kg / {max_weight}kg.",
      },
    },
  },

  session_claimed: {
    title: "You Made an Impact!",
    message: "You earned {points} points for making a greener choice🎉 Keep it up!",
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
