// src/controllers/otp.controller.js
const userModel = require("../models/user.model");
const otpModel = require("../models/otp.model");

const { sendOtpEmail } = require("../utils/mailer.utils");
const { generateOtp6, hashOtp } = require("../utils/otp.utils");
const response = require("../utils/response.utils");

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

exports.sendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return response.error(res, "Email and purpose are required", 400);
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!["signup", "reset"].includes(purpose)) {
      return response.error(res, "Invalid purpose", 400);
    }

    const existingUser = await userModel.getExistingUserByEmail(normalizedEmail);

    if (purpose === "signup" && existingUser) {
      return response.error(res, "Email already registered", 409);
    }

    if (purpose === "reset" && !existingUser) {
       return response.success(res, null, "If account exists, OTP sent", 200);
    }

    // ✅ resend cooldown
    const latest = await otpModel.findLatestOtp(normalizedEmail, purpose);

    if (latest) {
      const secondsSince = (Date.now() - new Date(latest.created_at).getTime()) / 1000;

      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        return response.error(res, `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince)}s before requesting another OTP`, 429);
      }
    }

    await otpModel.invalidateActiveOtps(normalizedEmail, purpose);

    const otp = generateOtp6();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await otpModel.createOtp({
      email: normalizedEmail,
      purpose,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    sendOtpEmail({ to: normalizedEmail, otp, purpose }).catch((err) => console.error("sendOtpEmail error:", err));

    return response.success(res, null, "OTP sent", 200);
  } catch (err) {
    console.error("sendOtp error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, purpose, otp } = req.body;

    if (!email || !purpose || !otp) {
      return response.error(res, "Email, purpose and otp are required", 400);
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!["signup", "reset"].includes(purpose)) {
      return response.error(res, "Invalid purpose", 400);
    }

    const inputOtp = String(otp).trim();
    if (!/^\d{6}$/.test(inputOtp)) {
      return response.error(res, "OTP must be 6 digits", 400);
    }

    // Find latest valid OTP
    const record = await otpModel.findLatestValidOtp(normalizedEmail, purpose);
    if (!record) {
      return response.error(res, "OTP expired or invalid", 400);
    }

    // Compare hash
    const inputHash = hashOtp(inputOtp);
    if (inputHash !== record.otp_hash) {
      return response.error(res, "Invalid OTP", 400);
    }

    // Mark used (prevents reuse)
    await otpModel.markUsed(record.id);

    return response.success(res, null, "OTP verified", 200);
  } catch (err) {
    console.error("verifyOtp error:", err);
    return response.error(res, "Internal Server Error", 500, err.message);
  }
};
