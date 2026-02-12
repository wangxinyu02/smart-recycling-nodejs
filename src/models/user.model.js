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

  getAllUsers: () => {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  },

  getUserById: (id) => {
    return prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });
  },

  updateUserById: (id, data) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });
  },
};
