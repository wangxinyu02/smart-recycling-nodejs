// src/models/merchant.model.js

const prisma = require("../config/prisma");

module.exports = {
  createMerchant: (data) => {
    return prisma.merchant.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  findActiveByEmail: (email) => {
    return prisma.merchant.findFirst({
      where: {
        email,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  findActiveById: (id) => {
    return prisma.merchant.findFirst({
      where: {
        id: Number(id),
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  listMerchants: ({ skip = 0, take = 20, q = "" }) => {
    const keyword = q?.trim();
    const where = {
      deleted_at: null,
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { email: { contains: keyword } },
              { phone: { contains: keyword } },
            ],
          }
        : {}),
    };

    return prisma.merchant.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
      orderBy: { created_at: "desc" },
    });
  },

  countMerchants: ({ q = "" }) => {
    const keyword = q?.trim();
    const where = {
      deleted_at: null,
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { email: { contains: keyword } },
              { phone: { contains: keyword } },
            ],
          }
        : {}),
    };

    return prisma.merchant.count({ where });
  },

  updateMerchantById: (id, data) => {
    return prisma.merchant.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },

  softDeleteMerchantById: (id) => {
    return prisma.merchant.update({
      where: { id: Number(id) },
      data: { deleted_at: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });
  },
};