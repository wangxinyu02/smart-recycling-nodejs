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
        updated_at: true,
        deleted_at: true,
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
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  getExistingUserById: (id) => {
    return prisma.user.findFirst({
      where: { id: Number(id), deleted_at: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  getExistingUserByEmail: (email) => {
    return prisma.user.findFirst({
      where: { email: email, deleted_at: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
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
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  deleteUserById: async (id) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data: { deleted_at: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  updatePasswordByEmail: (email, password_hash) => {
    return prisma.user.update({
      where: { email, deleted_at: null },
      data: { password_hash },
      select: {
        id: true,
        email: true,
        updated_at: true,
      },
    });
  },

  checkEmailExists: (email) => {
    return prisma.user.findFirst({
      where: { email: email, deleted_at: null },
      select: { id: true }, // only check existence
    });
  },
};
