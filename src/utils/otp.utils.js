// src/utils/otp.utils.js

const crypto = require("crypto");

function generateOtp6() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

module.exports = { generateOtp6, hashOtp };