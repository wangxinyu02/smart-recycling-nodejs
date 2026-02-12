// src/models/user.model.js

const prisma = require("../config/prisma");

module.exports = {
  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),

  findForLoginByEmail: (email) =>
    prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password_hash: true,
        role: true,
        created_at: true,
      },
    }),

  createUser: (data) =>
    prisma.user.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        password_hash: true,
      },
    }),
};
