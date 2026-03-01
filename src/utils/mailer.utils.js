// src/utils/mailer.utils.js

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true if using 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail({ to, otp, purpose }) {
  const subject =
    purpose === "signup"
      ? "Your verification code"
      : "Your password reset code";

  const text = `Your OTP code is: ${otp}\nThis code expires in 10 minutes.`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

module.exports = { sendOtpEmail };