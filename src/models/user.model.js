// src/models/user.model.js

const prisma = require("../config/prisma");

const selectUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  must_reset_password: true,
  password_reset_at: true,
  invited_at: true,
  invited_by: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
};

module.exports = {
  findExistingByEmail: (email) => prisma.user.findFirst({ where: { email, deleted_at: null } }),

  findExistingForLoginByEmail: (email) =>
    prisma.user.findFirst({
      where: { email, deleted_at: null },
      select: {
        id: true,
        name: true,
        email: true,
        password_hash: true,
        role: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    }),

  createUser: (data) =>
    prisma.user.create({
      data,
      select: selectUser,
    }),

  getAllUsers: async ({ page = 1, limit = 20, role }) => {
    const skip = (page - 1) * limit;

    const where = {
      deleted_at: null, // exclude soft-deleted users
    };

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  },

  getUserById: (id) => {
    return prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        ...selectUser,
        invited_by_user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  getExistingUserById: (id) => {
    return prisma.user.findFirst({
      where: { id: Number(id), deleted_at: null },
      select: selectUser,
    });
  },

  getExistingUserByEmail: (email) => {
    return prisma.user.findFirst({
      where: { email: email, deleted_at: null },
      select: selectUser,
    });
  },

  updateUserById: (id, data) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data,
      select: selectUser,
    });
  },

  deleteUserById: async (id) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data: { deleted_at: new Date() },
      select: selectUser,
    });
  },

  updatePasswordById: (id, password_hash) => {
    return prisma.user.update({
      where: { id },
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

  getUserPasswordById: (id) => {
    return prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        password_hash: true,
      },
    });
  },

  markPasswordAsReset: async (id) => {
    return prisma.user.update({
      where: { id: Number(id) },
      data: {
        must_reset_password: false,
        password_reset_at: new Date(),
      },
      select: selectUser,
    });
  },
};
