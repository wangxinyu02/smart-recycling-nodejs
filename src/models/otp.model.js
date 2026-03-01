// src/models/otp.model.js

const prisma = require("../config/prisma");

module.exports = {
  // Mark all active OTPs for this email+purpose as used
  invalidateActiveOtps: (email, purpose) => {
    return prisma.otpCode.updateMany({
      where: {
        email,
        purpose,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      data: { used_at: new Date() },
    });
  },

  // Create a new OTP record
  createOtp: ({ email, purpose, otp_hash, expires_at }) => {
    return prisma.otpCode.create({
      data: {
        email,
        purpose,
        otp_hash,
        expires_at,
        used_at: null,
      },
      select: {
        id: true,
        email: true,
        purpose: true,
        expires_at: true,
        used_at: true,
        created_at: true,
      },
    });
  },

  // Get the latest OTP for email+purpose (for cooldown check or verify)
  findLatestOtp: (email, purpose) => {
    return prisma.otpCode.findFirst({
      where: { email, purpose },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        purpose: true,
        otp_hash: true,
        created_at: true,
        expires_at: true,
        used_at: true,
      },
    });
  },

  // Get latest valid OTP
  findLatestValidOtp: (email, purpose) => {
    return prisma.otpCode.findFirst({
      where: {
        email,
        purpose,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        otp_hash: true,
        created_at: true,
        expires_at: true,
      },
    });
  },

  // Mark OTP used
  markUsed: (id) => {
    return prisma.otpCode.update({
      where: { id: Number(id) },
      data: { used_at: new Date() },
      select: {
        id: true,
        used_at: true,
      },
    });
  },
};