// src/utils/password.utils.js
const crypto = require("crypto");

const generateTemporaryPassword = (length = 8) => {
  // Simple readable temp password
  // Example: Ab3xP9kLm2
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, chars.length);
    password += chars[index];
  }
  return password;
};

module.exports = { generateTemporaryPassword };
