// src/utils/participation_rate.utils.js

function buildParticipationMessage(trend, percent) {
  // percent is already absolute number (e.g., 50 means +50%)
  if (trend === "up") {
    if (percent >= 50) {
      return {
        headline: "Great consistency! 🌟",
        description: "You're a recycling superstar! Keep increasing your impact. 🚀",
      };
    }
    if (percent >= 10) {
      return {
        headline: "Nice progress! 📈",
        description: "You're improving month by month. Keep it going.✨",
      };
    }
    return {
      headline: "Good job! 👍",
      description: "Small wins add up. Try to recycle a little more next month! 🌱",
    };
  }

  if (trend === "down") {
    return {
      headline: "Let’s get back on track! 💪",
      description: "A small recycling session this week can boost your impact! ♻️",
    };
  }

  // neutral
  return {
    headline: "Steady effort!",
    description: "Consistency matters. Maintain your great recycling habit! 🌍",
  };
}

module.exports = { buildParticipationMessage };
