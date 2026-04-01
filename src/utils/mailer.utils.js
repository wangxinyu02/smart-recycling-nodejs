// src/utils/mailer.utils.js

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function compileTemplate(templateName, data) {
  const filePath = path.join(__dirname, "../templates", `${templateName}.hbs`);
  const source = fs.readFileSync(filePath, "utf8");
  const template = handlebars.compile(source);
  return template(data);
}

async function sendOtpEmail({ to, otp, purpose }) {
  const title = purpose === "signup" ? "Verify Your Email" : "Reset Your Password";

  const subtitle = purpose === "signup" ? "Thank you for joining Smart Recycling 🌱" : "We received a request to reset your password.";

  const html = compileTemplate("otp.template", {
    otp,
    title,
    subtitle,
    expiryMinutes: 10,
    year: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Smart Recycling OTP Code",
    text: `Your OTP code is ${otp}. It expires in 10 minutes.`,
    html,
  });
}

async function sendAdminInvitation({ to, inviterName, name, email, password }) {
  const html = compileTemplate("invitation.template", {
    inviterName,
    name,
    email,
    password,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "You're Invited as an Admin - Smart Recycling",
    text: "",
    html,
  });
}

module.exports = { sendOtpEmail, sendAdminInvitation };
